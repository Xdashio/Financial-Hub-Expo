import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react-native';
import { radius, spacing, typography } from '@/theme';
import { useTheme } from '@/theme/ThemeContext';
import { BottomSheetModal } from './BottomSheetModal';

interface DatePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onDateSelect: (date: string) => void;
  initialDate?: string;
  minDate?: string;
  maxDate?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function DatePickerSheet({
  visible,
  onClose,
  onDateSelect,
  initialDate,
  minDate,
  maxDate,
}: DatePickerSheetProps) {
  const { colors } = useTheme();
  
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (initialDate) return new Date(initialDate);
    return new Date();
  });
  
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isDateDisabled = (date: Date): boolean => {
    if (minDate && date < new Date(minDate)) return true;
    if (maxDate && date > new Date(maxDate)) return true;
    return false;
  };

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  const handleDayPress = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    if (!isDateDisabled(newDate)) {
      setSelectedDate(newDate);
    }
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleConfirm = () => {
    onDateSelect(formatDate(selectedDate));
    onClose();
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const weeks = [];
    let currentWeek = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      currentWeek.push(<View key={`empty-${i}`} style={{ flex: 1 }} />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const isSelected = isSameDay(date, selectedDate);
      const isDisabled = isDateDisabled(date);

      currentWeek.push(
        <TouchableOpacity
          key={day}
          onPress={() => handleDayPress(day)}
          disabled={isDisabled}
          style={{
            flex: 1,
            aspectRatio: 1,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.sm,
            backgroundColor: isSelected ? colors.emeraldDeep : 'transparent',
            opacity: isDisabled ? 0.3 : 1,
          }}
        >
          <Text
            style={{
              ...typography.body,
              color: isSelected ? colors.surface : colors.ink,
              fontWeight: isSelected ? '600' : '400',
              fontSize: 15,
            }}
          >
            {day}
          </Text>
        </TouchableOpacity>
      );

      // Start a new week when we have 7 days
      if (currentWeek.length === 7) {
        weeks.push(
          <View key={`week-${weeks.length}`} style={{ flexDirection: 'row', gap: spacing.xs }}>
            {currentWeek}
          </View>
        );
        currentWeek = [];
      }
    }

    // Add the last week if it has remaining days
    if (currentWeek.length > 0) {
      // Fill the rest of the week with empty cells
      while (currentWeek.length < 7) {
        currentWeek.push(<View key={`empty-end-${currentWeek.length}`} style={{ flex: 1 }} />);
      }
      weeks.push(
        <View key={`week-${weeks.length}`} style={{ flexDirection: 'row', gap: spacing.xs }}>
          {currentWeek}
        </View>
      );
    }

    return weeks;
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Select Date"
    >
      <View style={{ gap: spacing.lg }}>
        {/* Month selector */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity
            onPress={handlePreviousMonth}
            style={{ padding: spacing.sm }}
            hitSlop={8}
          >
            <ChevronLeft size={24} color={colors.ink} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={{ ...typography.title, color: colors.ink }}>
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Text>
          <TouchableOpacity
            onPress={handleNextMonth}
            style={{ padding: spacing.sm }}
            hitSlop={8}
          >
            <ChevronRight size={24} color={colors.ink} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Weekday headers */}
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {WEEKDAYS.map((day) => (
            <View key={day} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ ...typography.caption, color: colors.sage, fontSize: 11 }}>
                {day}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={{ gap: spacing.xs }}>
          {renderCalendar()}
        </View>

        {/* Selected date display */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: colors.emeraldTint,
            padding: spacing.md,
            borderRadius: radius.sm,
          }}
        >
          <Calendar size={16} color={colors.emeraldDeep} strokeWidth={2} />
          <Text style={{ ...typography.body, color: colors.emeraldDeep }}>
            Selected: {formatDate(selectedDate)}
          </Text>
        </View>

        {/* Confirm button */}
        <TouchableOpacity
          onPress={handleConfirm}
          style={{
            backgroundColor: colors.emeraldDeep,
            paddingVertical: spacing.md,
            borderRadius: radius.sm,
            alignItems: 'center',
          }}
        >
          <Text style={{ ...typography.body, color: colors.surface, fontWeight: '600' }}>
            Confirm Date
          </Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
}
