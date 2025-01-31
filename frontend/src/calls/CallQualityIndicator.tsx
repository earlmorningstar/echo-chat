interface CallQualityIndicatorProps {
  quality: CallQuality;
}

const CallQualityIndicator: React.FC<CallQualityIndicatorProps> = ({
  quality,
}) => {
  const getQualityLevel = () => {
    const audioScore =
      quality.audio.bitrate > 30000 && quality.audio.packetsLost < 50;
    const videoScore = quality.video
      ? quality.video.bitrate > 500000 && quality.video.frameRate > 20
      : true;

    if (audioScore && videoScore) return "good";
    if (audioScore || videoScore) return "fair";
    return "poor";
  };
  return (
    <div className={`quality-indicator ${getQualityLevel()}`}>
      <div className="quality-dot"></div>
      <span className="quality-text">{getQualityLevel()}</span>
    </div>
  );
};

export default CallQualityIndicator;
