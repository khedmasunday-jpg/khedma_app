const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ✅ Security: Disable source maps and strip console logs in production
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_fnames: true,
    compress: {
      drop_console: true, // ✅ Remove all console.log from bundle
    },
  },
};

// ✅ Production build settings
if (process.env.NODE_ENV === 'production') {
  config.transformer.minifierConfig.output = {
    comments: false, // Remove all comments
  };
}

config.serializer = {
  ...config.serializer,
  sourceMap: false, // ✅ Security: Disable source maps in production
};

module.exports = config;
