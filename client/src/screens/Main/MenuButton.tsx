import React from 'react';
import { ScrollView, TouchableOpacity, StyleSheet, View, Text, LayoutChangeEvent } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MenuScreen from './MenuScreen';
import { StackNavigationProp } from '@react-navigation/stack';
import { StackParamList } from '../../types';
import { useNavigation } from '@react-navigation/native';
export default function MenuButton(){
  const navigation = useNavigation<StackNavigationProp<StackParamList>>();

  const handlePress = () => {
    navigation.navigate('MenuScreen'); 
  }
  return(
    <View>
      <TouchableOpacity onPress={handlePress} style={styles.iconContainer}>
        <Icon name="menu" size={30} color="#0D0D0D" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    marginLeft: '85%',
    marginBottom: '5%',
  },
});
