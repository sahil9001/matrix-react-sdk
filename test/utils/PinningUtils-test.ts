/*
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EventTimeline, EventType, IEvent, MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import { createTestClient } from "../test-utils";
import PinningUtils from "../../src/utils/PinningUtils";
import SettingsStore from "../../src/settings/SettingsStore";
import { isContentActionable } from "../../src/utils/EventUtils";
import { ReadPinsEventId } from "../../src/components/views/right_panel/types";

jest.mock("../../src/utils/EventUtils", () => {
    return {
        isContentActionable: jest.fn(),
        canPinEvent: jest.fn(),
    };
});

describe("PinningUtils", () => {
    const roomId = "!room:example.org";
    const userId = "@alice:example.org";

    const mockedIsContentActionable = mocked(isContentActionable);

    let matrixClient: MatrixClient;
    let room: Room;

    /**
     * Create a pinned event with the given content.
     * @param content
     */
    function makePinEvent(content?: Partial<IEvent>) {
        return new MatrixEvent({
            type: EventType.RoomMessage,
            sender: userId,
            content: {
                body: "First pinned message",
                msgtype: "m.text",
            },
            room_id: roomId,
            origin_server_ts: 0,
            event_id: "$eventId",
            ...content,
        });
    }

    beforeEach(() => {
        // Enable feature pinning
        jest.spyOn(SettingsStore, "getValue").mockReturnValue(true);
        mockedIsContentActionable.mockImplementation(() => true);

        matrixClient = createTestClient();
        room = new Room(roomId, matrixClient, userId);
        matrixClient.getRoom = jest.fn().mockReturnValue(room);

        jest.spyOn(
            matrixClient.getRoom(roomId)!.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
            "mayClientSendStateEvent",
        ).mockReturnValue(true);
    });

    describe("isUnpinnable", () => {
        test.each(PinningUtils.PINNABLE_EVENT_TYPES)("should return true for pinnable event types", (eventType) => {
            const event = makePinEvent({ type: eventType });
            expect(PinningUtils.isUnpinnable(event)).toBe(true);
        });

        test("should return false for a non pinnable event type", () => {
            const event = makePinEvent({ type: EventType.RoomCreate });
            expect(PinningUtils.isUnpinnable(event)).toBe(false);
        });

        test("should return true for a redacted event", () => {
            const event = makePinEvent({ unsigned: { redacted_because: "because" as unknown as IEvent } });
            expect(PinningUtils.isUnpinnable(event)).toBe(true);
        });
    });

    describe("isPinnable", () => {
        test.each(PinningUtils.PINNABLE_EVENT_TYPES)("should return true for pinnable event types", (eventType) => {
            const event = makePinEvent({ type: eventType });
            expect(PinningUtils.isPinnable(event)).toBe(true);
        });

        test("should return false for a redacted event", () => {
            const event = makePinEvent({ unsigned: { redacted_because: "because" as unknown as IEvent } });
            expect(PinningUtils.isPinnable(event)).toBe(false);
        });
    });

    describe("isPinned", () => {
        test("should return false if no room", () => {
            matrixClient.getRoom = jest.fn().mockReturnValue(undefined);
            const event = makePinEvent();

            expect(PinningUtils.isPinned(matrixClient, event)).toBe(false);
        });

        test("should return false if no pinned event", () => {
            jest.spyOn(
                matrixClient.getRoom(roomId)!.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "getStateEvents",
            ).mockReturnValue(null);

            const event = makePinEvent();
            expect(PinningUtils.isPinned(matrixClient, event)).toBe(false);
        });

        test("should return false if pinned events do not contain the event id", () => {
            jest.spyOn(
                matrixClient.getRoom(roomId)!.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "getStateEvents",
            ).mockReturnValue({
                // @ts-ignore
                getContent: () => ({ pinned: ["$otherEventId"] }),
            });

            const event = makePinEvent();
            expect(PinningUtils.isPinned(matrixClient, event)).toBe(false);
        });

        test("should return true if pinned events contains the event id", () => {
            const event = makePinEvent();
            jest.spyOn(
                matrixClient.getRoom(roomId)!.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "getStateEvents",
            ).mockReturnValue({
                // @ts-ignore
                getContent: () => ({ pinned: [event.getId()] }),
            });

            expect(PinningUtils.isPinned(matrixClient, event)).toBe(true);
        });
    });

    describe("canPinOrUnpin", () => {
        test("should return false if pinning is disabled", () => {
            // Disable feature pinning
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
            const event = makePinEvent();

            expect(PinningUtils.canPinOrUnpin(matrixClient, event)).toBe(false);
        });

        test("should return false if event is not actionable", () => {
            mockedIsContentActionable.mockImplementation(() => false);
            const event = makePinEvent();

            expect(PinningUtils.canPinOrUnpin(matrixClient, event)).toBe(false);
        });

        test("should return false if no room", () => {
            matrixClient.getRoom = jest.fn().mockReturnValue(undefined);
            const event = makePinEvent();

            expect(PinningUtils.canPinOrUnpin(matrixClient, event)).toBe(false);
        });

        test("should return false if client cannot send state event", () => {
            jest.spyOn(
                matrixClient.getRoom(roomId)!.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "mayClientSendStateEvent",
            ).mockReturnValue(false);
            const event = makePinEvent();

            expect(PinningUtils.canPinOrUnpin(matrixClient, event)).toBe(false);
        });

        test("should return false if event is not pinnable", () => {
            const event = makePinEvent({ type: EventType.RoomCreate });

            expect(PinningUtils.canPinOrUnpin(matrixClient, event)).toBe(false);
        });

        test("should return true if all conditions are met", () => {
            const event = makePinEvent();

            expect(PinningUtils.canPinOrUnpin(matrixClient, event)).toBe(true);
        });
    });

    describe("pinOrUnpinEvent", () => {
        test("should do nothing if no room", async () => {
            matrixClient.getRoom = jest.fn().mockReturnValue(undefined);
            const event = makePinEvent();

            await PinningUtils.pinOrUnpinEvent(matrixClient, event);
            expect(matrixClient.sendStateEvent).not.toHaveBeenCalled();
        });

        test("should do nothing if no event id", async () => {
            const event = makePinEvent({ event_id: undefined });

            await PinningUtils.pinOrUnpinEvent(matrixClient, event);
            expect(matrixClient.sendStateEvent).not.toHaveBeenCalled();
        });

        test("should pin the event if not pinned", async () => {
            jest.spyOn(
                matrixClient.getRoom(roomId)!.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "getStateEvents",
            ).mockReturnValue({
                // @ts-ignore
                getContent: () => ({ pinned: ["$otherEventId"] }),
            });

            jest.spyOn(room, "getAccountData").mockReturnValue({
                getContent: jest.fn().mockReturnValue({
                    event_ids: ["$otherEventId"],
                }),
            } as unknown as MatrixEvent);

            const event = makePinEvent();
            await PinningUtils.pinOrUnpinEvent(matrixClient, event);

            expect(matrixClient.setRoomAccountData).toHaveBeenCalledWith(roomId, ReadPinsEventId, {
                event_ids: ["$otherEventId", event.getId()],
            });
            expect(matrixClient.sendStateEvent).toHaveBeenCalledWith(
                roomId,
                EventType.RoomPinnedEvents,
                { pinned: ["$otherEventId", event.getId()] },
                "",
            );
        });

        test("should unpin the event if already pinned", async () => {
            const event = makePinEvent();

            jest.spyOn(
                matrixClient.getRoom(roomId)!.getLiveTimeline().getState(EventTimeline.FORWARDS)!,
                "getStateEvents",
            ).mockReturnValue({
                // @ts-ignore
                getContent: () => ({ pinned: [event.getId(), "$otherEventId"] }),
            });

            await PinningUtils.pinOrUnpinEvent(matrixClient, event);
            expect(matrixClient.sendStateEvent).toHaveBeenCalledWith(
                roomId,
                EventType.RoomPinnedEvents,
                { pinned: ["$otherEventId"] },
                "",
            );
        });
    });
});
