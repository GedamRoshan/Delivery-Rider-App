module.exports = {
  preset: '@react-native/jest-preset',
  watchman: false,
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-native-community|@react-navigation|firebase|@firebase)',
  ],
};
