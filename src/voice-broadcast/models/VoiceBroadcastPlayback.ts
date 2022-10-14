/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "matrix-js-sdk/src/matrix";
import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";

import { IDestroyable } from "../../utils/IDestroyable";

export enum VoiceBroadcastPlaybackState {
    Paused,
    Playing,
    Stopped,
}

export enum VoiceBroadcastPlaybackEvent {
    StateChanged = "state_changed",
}

interface EventMap {
    [VoiceBroadcastPlaybackEvent.StateChanged]: (state: VoiceBroadcastPlaybackState) => void;
}

export class VoiceBroadcastPlayback
    extends TypedEventEmitter<VoiceBroadcastPlaybackEvent, EventMap>
    implements IDestroyable {
    private state = VoiceBroadcastPlaybackState.Stopped;

    public constructor(
        public readonly infoEvent: MatrixEvent,
    ) {
        super();
    }

    public start() {
        this.setState(VoiceBroadcastPlaybackState.Playing);
    }

    public stop() {
        this.setState(VoiceBroadcastPlaybackState.Stopped);
    }

    public toggle() {
        if (this.state === VoiceBroadcastPlaybackState.Stopped) {
            this.setState(VoiceBroadcastPlaybackState.Playing);
            return;
        }

        this.setState(VoiceBroadcastPlaybackState.Stopped);
    }

    public getState(): VoiceBroadcastPlaybackState {
        return this.state;
    }

    private setState(state: VoiceBroadcastPlaybackState): void {
        this.state = state;
        this.emit(VoiceBroadcastPlaybackEvent.StateChanged, state);
    }

    destroy(): void {
        this.removeAllListeners();
    }
}