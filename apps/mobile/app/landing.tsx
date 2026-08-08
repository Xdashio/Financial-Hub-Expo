import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, Dimensions, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, radius, typography } from '@/theme';
import { Button, ScreenContainer } from '@/components/ui';
import { Shield, TrendingUp, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: 1,
    icon: null as any,
    title: 'Financial Hub',
    description: 'Your behavior-driven financial intelligence layer',
  },
  {
    id: 2,
    icon: Shield,
    title: 'Protected savings',
    description: 'Minimum 10% of income, time-locked and guarded against impulse',
  },
  {
    id: 3,
    icon: TrendingUp,
    title: 'Smart allocations',
    description: 'Income automatically split into pockets based on your behavior',
  },
];

export default function LandingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleSlideChange = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / width);
    setActiveSlide(pageIndex);
  };

  const goToSlide = (index: number) => {
    setActiveSlide(index);
    scrollViewRef.current?.scrollTo({ x: index * width, animated: true });
  };

  const goToNext = () => {
    if (activeSlide < SLIDES.length - 1) {
      goToSlide(activeSlide + 1);
    }
  };

  const goToPrev = () => {
    if (activeSlide > 0) {
      goToSlide(activeSlide - 1);
    }
  };

  const handleGetStarted = () => {
    router.push('/(auth)/signup');
  };

  const handleSignIn = () => {
    router.push('/(auth)/signin');
  };

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleSlideChange}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {SLIDES.map((slide, index) => (
            <View key={slide.id} style={{ width, paddingHorizontal: spacing.xl, flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              {/* Logo - only on first slide */}
              {index === 0 && (
                <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
                  <Image 
                    source={require('../assets/financial_hub_logo_transparent.png')}
                    style={{ width: 72, height: 72 }}
                    resizeMode="contain"
                  />
                </View>
              )}

              {/* Icon - no background, skip if null */}
              {slide.icon && (
                <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
                  <slide.icon size={44} color={colors.emeraldDeep} strokeWidth={1.5} />
                </View>
              )}

              {/* Title */}
              <Text style={{ 
                ...typography.display, 
                fontSize: 26, 
                color: colors.ink, 
                textAlign: 'center', 
                marginBottom: spacing.sm,
                lineHeight: 34,
                paddingHorizontal: spacing.md,
              }}>
                {slide.title}
              </Text>

              {/* Description */}
              <Text style={{ 
                ...typography.body, 
                color: colors.sage, 
                textAlign: 'center', 
                lineHeight: 22,
                marginBottom: spacing.xl,
                paddingHorizontal: spacing.md,
              }}>
                {slide.description}
              </Text>

              {/* CTA on last slide */}
              {index === SLIDES.length - 1 && (
                <View style={{ gap: spacing.sm, marginTop: spacing.md, width: '100%', paddingHorizontal: spacing.md }}>
                  <Button
                    fullWidth
                    size="lg"
                    onPress={handleGetStarted}
                    rightIcon={<ArrowRight size={18} color="#fff" />}
                  >
                    Get Started
                  </Button>
                  <Pressable 
                    style={{ alignItems: 'center', paddingVertical: spacing.sm }}
                    onPress={handleSignIn}
                  >
                    <Text style={{ ...typography.body, color: colors.emeraldDeep }}>
                      Already have an account? Sign in
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Navigation and Pagination */}
        <View style={{ 
          paddingBottom: spacing.xl,
          paddingHorizontal: spacing.xl,
          flexDirection: 'row', 
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Previous Button */}
          <Pressable
            onPress={goToPrev}
            disabled={activeSlide === 0}
            style={{ 
              padding: spacing.md,
              opacity: activeSlide === 0 ? 0.3 : 1,
            }}
          >
            <ChevronLeft size={28} color={colors.emeraldDeep} />
          </Pressable>

          {/* Pagination Dots */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'center', 
            gap: spacing.sm,
          }}>
            {SLIDES.map((_, index) => (
              <Pressable
                key={index}
                onPress={() => goToSlide(index)}
                style={{ 
                  width: index === activeSlide ? 24 : 8, 
                  height: 8, 
                  borderRadius: radius.pill, 
                  backgroundColor: index === activeSlide ? colors.emeraldDeep : colors.lineSoft,
                }}
              />
            ))}
          </View>

          {/* Next Button */}
          <Pressable
            onPress={goToNext}
            disabled={activeSlide === SLIDES.length - 1}
            style={{ 
              padding: spacing.md,
              opacity: activeSlide === SLIDES.length - 1 ? 0.3 : 1,
            }}
          >
            <ChevronRight size={28} color={colors.emeraldDeep} />
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}