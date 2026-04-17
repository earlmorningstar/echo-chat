const EchoChatLoader = () => {
  return (
    <div className="echochat-loader-container">

      {/* Skeleton chat list — anchors user to where they're going */}
      <div className="echochat-skeleton">
        {[0, 1, 2, 3].map((i) => (
          <div className="skeleton-item" key={i}>
            <div className="skeleton-avatar" />
            <div className="skeleton-lines">
              <div className="skeleton-line name" />
              <div className="skeleton-line preview" />
            </div>
            <div className="skeleton-meta">
              <div className="skeleton-line time" />
            </div>
          </div>
        ))}
      </div>

      {/* Frosted glass card — floats above skeleton */}
      <div className="echochat-loader-card">

        {/* Logo with breathing pulse rings */}
        <div className="echochat-logo-wrapper">
          <div className="echochat-pulse-ring ring-1" />
          <div className="echochat-pulse-ring ring-2" />
          <div className="echochat-logo-circle">
            <span className="echochat-logo-initial">E</span>
          </div>
        </div>

        <span className="echochat-logo-text">EchoChat</span>

        {/* Progress bar — progress illusion */}
        <div className="echochat-progress-track">
          <div className="echochat-progress-fill" />
        </div>

        {/* Cycling status messages — perceived control */}
        <div className="echochat-status-wrapper">
          <span className="status-msg msg-1">Getting things ready…</span>
          <span className="status-msg msg-2">Loading…</span>
          <span className="status-msg msg-3">Almost there…</span>
        </div>

      </div>
    </div>
  );
};


export default EchoChatLoader;