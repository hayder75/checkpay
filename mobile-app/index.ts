import { registerRootComponent } from 'expo';

import App from './App';
import { registerSMSHeadlessTask } from './src/services/SMSHeadlessTask';

// Register HeadlessJS task for background SMS processing
// This must be called before registerRootComponent
registerSMSHeadlessTask();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
