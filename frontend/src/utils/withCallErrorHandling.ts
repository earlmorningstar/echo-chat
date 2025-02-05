const withCallErrorHandling =
  <T extends any[], R>(fn: (...args: T) => Promise<R>) =>
  async (...args: T): Promise<R | void> => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error("Call operation failed:", error);
      throw error;
    }
  };

  export default withCallErrorHandling;
