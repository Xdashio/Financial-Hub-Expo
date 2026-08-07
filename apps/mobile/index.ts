import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';

// Must be outside of any React Lifecycle function (e.g. useEffect or componentDidMount)
registerRootComponent(ExpoRoot);
