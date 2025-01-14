/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { useCallback, useEffect, JSX } from "react";
import { Room, MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";
import { Button, Separator } from "@vector-im/compound-web";
import classNames from "classnames";
import PinIcon from "@vector-im/compound-design-tokens/assets/web/icons/pin";

import { _t } from "../../../languageHandler";
import BaseCard from "./BaseCard";
import Spinner from "../elements/Spinner";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";
import { PinnedEventTile } from "../rooms/PinnedEventTile";
import { useRoomState } from "../../../hooks/useRoomState";
import RoomContext, { TimelineRenderingType, useRoomContext } from "../../../contexts/RoomContext";
import { ReadPinsEventId } from "./types";
import Heading from "../typography/Heading";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { filterBoolean } from "../../../utils/arrays";
import Modal from "../../../Modal";
import { UnpinAllDialog } from "../dialogs/UnpinAllDialog";
import EmptyState from "./EmptyState";
import { usePinnedEvents, useReadPinnedEvents, useSortedFetchedPinnedEvents } from "../../../hooks/usePinnedEvents";

/**
 * List the pinned messages in a room inside a Card.
 */
interface PinnedMessagesCardProps {
    /**
     * The room to list the pinned messages for.
     */
    room: Room;
    /**
     * Permalink of the room.
     */
    permalinkCreator: RoomPermalinkCreator;
    /**
     * Callback for when the card is closed.
     */
    onClose(): void;
}

export function PinnedMessagesCard({ room, onClose, permalinkCreator }: PinnedMessagesCardProps): JSX.Element {
    const cli = useMatrixClientContext();
    const roomContext = useRoomContext();
    const pinnedEventIds = usePinnedEvents(room);
    const readPinnedEvents = useReadPinnedEvents(room);
    const pinnedEvents = useSortedFetchedPinnedEvents(room, pinnedEventIds);

    useEffect(() => {
        if (!cli || cli.isGuest()) return; // nothing to do
        const newlyRead = pinnedEventIds.filter((id) => !readPinnedEvents.has(id));
        if (newlyRead.length > 0) {
            // clear out any read pinned events which no longer are pinned
            cli.setRoomAccountData(room.roomId, ReadPinsEventId, {
                event_ids: pinnedEventIds,
            });
        }
    }, [cli, room.roomId, pinnedEventIds, readPinnedEvents]);

    let content: JSX.Element;
    if (!pinnedEventIds.length) {
        content = (
            <EmptyState
                Icon={PinIcon}
                title={_t("right_panel|pinned_messages|empty_title")}
                description={_t("right_panel|pinned_messages|empty_description", {
                    pinAction: _t("action|pin"),
                })}
            />
        );
    } else if (pinnedEvents?.length) {
        content = (
            <PinnedMessages events={filterBoolean(pinnedEvents)} room={room} permalinkCreator={permalinkCreator} />
        );
    } else {
        content = <Spinner />;
    }

    return (
        <BaseCard
            header={
                <div className="mx_BaseCard_header_title">
                    <Heading size="4" className="mx_BaseCard_header_title_heading">
                        {_t("right_panel|pinned_messages|header", { count: pinnedEventIds.length })}
                    </Heading>
                </div>
            }
            className="mx_PinnedMessagesCard"
            onClose={onClose}
        >
            <RoomContext.Provider
                value={{
                    ...roomContext,
                    timelineRenderingType: TimelineRenderingType.Pinned,
                }}
            >
                {content}
            </RoomContext.Provider>
        </BaseCard>
    );
}

/**
 * The pinned messages in a room.
 */
interface PinnedMessagesProps {
    /**
     * The pinned events.
     */
    events: MatrixEvent[];
    /**
     * The room the events are in.
     */
    room: Room;
    /**
     * The permalink creator to use.
     */
    permalinkCreator: RoomPermalinkCreator;
}

/**
 * The pinned messages in a room.
 */
function PinnedMessages({ events, room, permalinkCreator }: PinnedMessagesProps): JSX.Element {
    const matrixClient = useMatrixClientContext();

    /**
     * Whether the client can unpin events from the room.
     */
    const canUnpin = useRoomState(room, (state) =>
        state.mayClientSendStateEvent(EventType.RoomPinnedEvents, matrixClient),
    );

    /**
     * Opens the unpin all dialog.
     */
    const onUnpinAll = useCallback(async (): Promise<void> => {
        Modal.createDialog(UnpinAllDialog, {
            roomId: room.roomId,
            matrixClient,
        });
    }, [room, matrixClient]);

    return (
        <>
            <div
                className={classNames("mx_PinnedMessagesCard_wrapper", {
                    mx_PinnedMessagesCard_wrapper_unpin_all: canUnpin,
                })}
                role="list"
            >
                {events.reverse().map((event, i) => (
                    <>
                        <PinnedEventTile
                            key={event.getId()}
                            event={event}
                            permalinkCreator={permalinkCreator}
                            room={room}
                        />
                        {/* Add a separator if this isn't the last pinned message */}
                        {events.length - 1 !== i && (
                            <Separator key={`separator-${event.getId()}`} className="mx_PinnedMessagesCard_Separator" />
                        )}
                    </>
                ))}
            </div>
            {canUnpin && (
                <div className="mx_PinnedMessagesCard_unpin">
                    <Button kind="tertiary" onClick={onUnpinAll}>
                        {_t("right_panel|pinned_messages|unpin_all|button")}
                    </Button>
                </div>
            )}
        </>
    );
}
