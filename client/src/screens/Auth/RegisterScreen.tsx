import React, { useState } from 'react';
import { TextInput, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Logo from '../../logo';
import { FIREBASE_AUTH } from '../../../FirebaseConfig';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, Timestamp, doc, setDoc } from 'firebase/firestore';
import { RegisterScreenProps } from '../../types';

export default function RegisterScreen({ navigation }: RegisterScreenProps) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = FIREBASE_AUTH;
  const firestore = getFirestore();

  const handleRegister = async () => {
    setLoading(true);
    try {
      const response = await createUserWithEmailAndPassword(auth, email, password);
      
      if (auth.currentUser?.uid) {
        const uid = auth.currentUser.uid;
        await setDoc(doc(firestore, 'users', uid), {
          name: name,
          email: email,
          username: username,
          bio: bio,
          createdAt: Timestamp.fromDate(new Date()),
        });
        navigation.navigate('ProfileSetUpScreen', { name, username, bio });
      } else {
        throw new Error("User ID is undefined.");
      }
    } catch (error) {
      if (error instanceof Error) {
        alert('Registration failed: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Logo />
      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name}
        autoCapitalize="none"
        onChangeText={(text) => setName(text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        keyboardType="ascii-capable"
        autoCapitalize="none"
        onChangeText={(text) => setUsername(text.toLowerCase())}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        keyboardType="email-address"
        autoCapitalize="none"
        onChangeText={(text) => setEmail(text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        secureTextEntry
        onChangeText={(text) => setPassword(text)}
      />
      <TouchableOpacity style={styles.submit} onPress={handleRegister}>
        <Text style={styles.submitText}>Sign up</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    flex: 1,
    marginTop:'-75%',
    backgroundColor: '#F8F3FA',
   
  },
  input: {
    height: 51,
    borderRadius: 16,
    backgroundColor: '#E3E3E3',
    borderColor: '#E3E3E3',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 20,
    marginLeft: 50,
    marginRight: 50,
  },
  submit: {
    backgroundColor: '#0d0d0d',
    borderRadius: 16,
    height: 51,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    marginLeft: 50,
    marginRight: 50,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
  },
});
