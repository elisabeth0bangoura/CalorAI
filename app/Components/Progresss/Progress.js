// ProgressComponent.js
import React from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';
import MyWeightAndStrikesComponent from './MyWeightAndStrikes';
import TotalCalories from "./TotalCalories";
import LineChartComponent from './YourGoalProgress';







const categories = [
  { id: 'protein', label: 'Protein', grams: 80,  color: '#691AF5' },
  { id: 'carbs',   label: 'Carbs',   grams: 220, color: '#00CE39' },
  { id: 'sugar',   label: 'Sugar',   grams: 60,  color: '#FFA2E2' },
  { id: 'fat',     label: 'Fat',     grams: 70,  color: '#F7931A' },
];
const KCAL = { protein: 4, carbs: 4, sugar: 4, fat: 9 };

export default function ProgressComponent() {

  const { width, height } = useWindowDimensions();
  const W = Math.round(width * 0.9);
  const H = Math.min(420, Math.round(height * 0.55));

  const data = categories.map(c => {
    const kcal = Math.round((c.grams || 0) * (KCAL[c.id] || 0));
    return {
      name: c.label,
      value: kcal,
      color: c.color,
      grams: c.grams,
      kcal,
      gramsColor: '#FFFFFF',
      kcalColor:  '#FFFFFF',
      titleColor: '#FFFFFF',
    };
  });

  const content = (
    <>
      <MyWeightAndStrikesComponent />

      <View style={{ width: '90%', marginTop: 50, alignSelf: 'center' }}>
      
        <LineChartComponent />
      </View>

      <View style={{ width: '90%', marginTop: 40, alignSelf: 'center' }}>
      

      <TotalCalories />


      </View>
    </>
  );

  // Use FlatList as the outer container to avoid the VirtualizedList warning
  return (
    <FlatList
      data={[{ key: 'content' }]}
      keyExtractor={(i) => i.key}
      renderItem={() => content}
      contentContainerStyle={{ backgroundColor: '#fff', paddingBottom: 180}}
    />
  );
}
