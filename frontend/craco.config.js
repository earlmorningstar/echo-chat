module.exports = {
    webpack: {
      configure: (webpackConfig) => {
        webpackConfig.ignoreWarnings = [
          {
            module: /@twilio\/audioplayer/,
            message: /Failed to parse source map/,
          },
        ];
        return webpackConfig;
      },
    },
  };
  