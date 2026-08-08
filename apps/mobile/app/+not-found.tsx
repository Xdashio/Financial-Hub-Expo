import { View, Text } from 'react-native';
import { Link } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { typography, radius } from '@/theme';

export default function NotFound() {
  const { colors } = useTheme();
  
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.paper }}>
      <Text style={{ ...typography.display, fontSize: 24, marginBottom: 8, color: colors.ink }}>404 - Page Not Found</Text>
      <Text style={{ ...typography.body, color: colors.sage, marginBottom: 24, textAlign: 'center' }}>The page you're looking for doesn't exist.</Text>
      <Link href="/" style={{ backgroundColor: colors.emeraldDeep, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.button }}>
        <Text style={{ color: '#fff', ...typography.body }}>Go Home</Text>
      </Link>
    </View>
  );
}