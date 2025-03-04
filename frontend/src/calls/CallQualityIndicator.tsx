// import React, { useMemo } from "react";
// import {
//   SignalCellular4Bar,
//   SignalCellular3Bar,
//   SignalCellular2Bar,
//   SignalCellular1Bar,
//   SignalCellularNull,
// } from "@mui/icons-material";
// import { CallQuality } from "../types";

// interface CallQualityProps {
//   quality: CallQuality;
// }

// const CallQualityIndicator: React.FC<CallQualityProps> = ({ quality }) => {
//   const getQualityScore = useMemo(() => {
//     let score = 0;

//     // audio quality scoring (0-40 points)
//     if (quality.audio) {
//       // Bitrate scoring (0-15 points)
//       if (quality.audio.bitrate >= 32000) score += 15;
//       else if (quality.audio.bitrate >= 24000) score += 10;
//       else if (quality.audio.bitrate >= 16000) score += 5;

//       // packet loss scoring (0-15 points)
//       if (quality.audio.packetsLost === 0) score += 15;
//       else if (quality.audio.packetsLost < 0.5) score += 10;
//       else if (quality.audio.packetsLost < 2) score += 5;

//       // round trip time scoring (0-10 points)
//       if (quality.audio.roundTripTime < 100) score += 10;
//       else if (quality.audio.roundTripTime < 200) score += 5;
//       else if (quality.audio.roundTripTime < 300) score += 2;
//     }

//     // video quality scoring (0-60 points, if video exists)
//     if (quality.video) {
//       // bitrate scoring (0-20 points)
//       if (quality.video.bitrate >= 1000000) score += 20;
//       else if (quality.video.bitrate >= 500000) score += 15;
//       else if (quality.video.bitrate >= 250000) score += 10;

//       // Frame rate scoring (0-20 points)
//       if (quality.video.frameRate >= 30) score += 20;
//       else if (quality.video.frameRate >= 24) score += 15;
//       else if (quality.video.frameRate >= 15) score += 10;

//       // resolution scoring (0-20 points)
//       const pixels =
//         quality.video.resolution.width * quality.video.resolution.height;
//       if (pixels >= 921600) score += 20; // 1280x720 or higher
//       else if (pixels >= 409920) score += 15; // 854x480 or higher
//       else if (pixels >= 147456) score += 10; // 512x288 or higher
//     }

//     return score;
//   }, [quality]);

//   const QualityIcon = useMemo(() => {
//     const maxScore = quality.video ? 100 : 40;
//     const percentage = (getQualityScore / maxScore) * 100;

//     if (percentage >= 80) return SignalCellular4Bar;
//     if (percentage >= 60) return SignalCellular3Bar;
//     if (percentage >= 40) return SignalCellular2Bar;
//     if (percentage >= 20) return SignalCellular1Bar;
//     return SignalCellularNull;
//   }, [getQualityScore, quality.video]);

//   return (
//     <div
//       className="call-quality-indicator"
//       title={`Call Quality: ${getQualityScore}%`}
//     >
//       <QualityIcon
//         className={`quality-icon quality-level-${Math.floor(
//           getQualityScore / 20
//         )}`}
//       />
//     </div>
//   );
// };

// export default CallQualityIndicator;
export {};