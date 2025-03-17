import * as TwilioVideo from "twilio-video";
import * as TwilioVoice from "@twilio/voice-sdk";

export type VoiceCallEntity = TwilioVoice.Connection | TwilioVoice.Call;
export type ActiveCall = TwilioVideo.Room | VoiceCallEntity | null;

//Re-export Twilio types for easy access
export { TwilioVideo, TwilioVoice };
