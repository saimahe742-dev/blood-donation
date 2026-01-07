// App.js
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TextInput, Button, FlatList, Alert, TouchableOpacity } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp
} from 'firebase/firestore';

// ------------------ REPLACE with your Firebase project config ------------------
const firebaseConfig = {
  apiKey: "REPLACE",
  authDomain: "REPLACE",
  projectId: "REPLACE",
  storageBucket: "REPLACE",
  messagingSenderId: "REPLACE",
  appId: "REPLACE"
};
// --------------------------------------------------------------------------------

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Utility: add days to a Date (returns ISO string)
function addDaysISO(dateISO, days) {
  const d = new Date(dateISO);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

// --- Data model: /donors documents have:
// name, bloodType, district, contactNumber, lastDonationDate (ISO) | null,
// nextEligibleDate (ISO) | null, createdAt
//
// Example Firestore doc:
// {
//   name: "Ravi",
//   bloodType: "A+",
//   district: "Chennai",
//   contactNumber: "+91xxxxxxxxxx",
//   lastDonationDate: "2025-09-01T12:00:00.000Z"  // ISO string
//   nextEligibleDate: "2025-11-03T12:00:00.000Z"  // ISO string (63 days later)
//   createdAt: <serverTimestamp>
// }

export default function App() {
  // Registration form state
  const [name, setName] = useState('');
  const [bloodType, setBloodType] = useState('A+');
  const [district, setDistrict] = useState('Select district');
  const [contactNumber, setContactNumber] = useState('');
  const [lastDonationDate, setLastDonationDate] = useState(''); // ISO date string or '' (user-provided)
  // Search state
  const [searchBloodType, setSearchBloodType] = useState('A+');
  const [searchDistrict, setSearchDistrict] = useState('Select district');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Simple district list (you can replace with full list)
  const districts = ['Select district', 'Chennai', 'Coimbatore', 'Madurai', 'Trichy', 'Bengaluru', 'Hyderabad'];

  // Helper to register donor
  async function registerDonor() {
    if (!name.trim() || !contactNumber.trim() || district === 'Select district') {
      Alert.alert('Please fill name, contact and district');
      return;
    }

    // Compute nextEligibleDate if lastDonationDate provided.
    let nextEligibleDate = null;
    let lastDonationISO = null;
    if (lastDonationDate.trim()) {
      // Accept ISO date (yyyy-mm-dd) or attempt Date parse (simple)
      const d = new Date(lastDonationDate);
      if (isNaN(d.getTime())) {
        Alert.alert('Invalid last donation date. Use YYYY-MM-DD or leave blank.');
        return;
      }
      lastDonationISO = d.toISOString();
      nextEligibleDate = addDaysISO(lastDonationISO, 63); // 9 weeks = 63 days
    }

    try {
      await addDoc(collection(db, 'donors'), {
        name: name.trim(),
        bloodType,
        district,
        contactNumber: contactNumber.trim(),
        lastDonationDate: lastDonationISO,
        nextEligibleDate,
        createdAt: serverTimestamp()
      });
      Alert.alert('Registered', 'Donor saved successfully.');
      // reset form
      setName('');
      setContactNumber('');
      setLastDonationDate('');
      setDistrict('Select district');
      setBloodType('A+');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not save donor.');
    }
  }

  // Search donors by blood type & district, excluding donors who are not yet eligible
  async function searchDonors() {
    if (searchDistrict === 'Select district') {
      Alert.alert('Please select a district to search');
      return;
    }
    setLoading(true);
    try {
      // Query: exact match on district & bloodType
      const donorsRef = collection(db, 'donors');
      const q = query(donorsRef, where('district', '==', searchDistrict), where('bloodType', '==', searchBloodType));
      const snap = await getDocs(q);
      const now = new Date();

      const list = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const nextEligibleISO = data.nextEligibleDate || null;
        // If nextEligibleDate exists and is in future -> skip (not eligible)
        let eligible = true;
        if (nextEligibleISO) {
          const nextDate = new Date(nextEligibleISO);
          if (nextDate > now) eligible = false;
        }
        list.push({
          id: docSnap.id,
          name: data.name || '—',
          contactNumber: data.contactNumber || '—',
          lastDonationDate: data.lastDonationDate || null,
          nextEligibleDate: data.nextEligibleDate || null,
          eligible
        });
      });

      // Optionally filter only eligible donors first
      const eligibleFirst = list.sort((a,b) => (a.eligible === b.eligible) ? 0 : (a.eligible ? -1 : 1));
      setResults(eligibleFirst);
    } catch (err) {
      console.error(err);
      Alert.alert('Error searching donors');
    } finally {
      setLoading(false);
    }
  }

  // Mark donation for a donor (sets lastDonationDate to now, computes nextEligibleDate = now + 63 days)
  async function markDonorDonated(donorId) {
    try {
      const donorRef = doc(db, 'donors', donorId);
      const nowISO = new Date().toISOString();
      const nextEligibleISO = addDaysISO(nowISO, 63);
      await updateDoc(donorRef, {
        lastDonationDate: nowISO,
        nextEligibleDate: nextEligibleISO
      });
      Alert.alert('Marked', 'Donor marked as donated — they will be ineligible for 9 weeks.');
      // Refresh results
      searchDonors();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not mark donation.');
    }
  }

  // Simple render of each donor result
  function renderDonor({ item }) {
    return (
      <View style={styles.resultRow}>
        <View style={{flex:1}}>
          <Text style={styles.resultName}>{item.name} {item.eligible ? '' : '(Not eligible)'}</Text>
          <Text>Contact: {item.contactNumber}</Text>
          {item.lastDonationDate ? <Text>Last: {new Date(item.lastDonationDate).toLocaleDateString()}</Text> : <Text>Last: —</Text>}
          {item.nextEligibleDate ? <Text>Next eligible: {new Date(item.nextEligibleDate).toLocaleDateString()}</Text> : null}
        </View>

        <View style={{justifyContent:'space-between'}}>
          {/* Show contact immediately — user asked for immediate contact */}
          <TouchableOpacity style={styles.contactBtn} onPress={() => {
            // Immediate contact: show phone number in alert (or integrate phone call)
            Alert.alert('Contact Number', item.contactNumber);
          }}>
            <Text style={{color:'white'}}>Show Contact</Text>
          </TouchableOpacity>

          {/* Mark donated button — only enable if you are an admin or verifying staff in real app */}
          <TouchableOpacity style={[styles.markBtn, { backgroundColor: '#444' }]} onPress={() => {
            Alert.alert('Confirm', `Mark ${item.name} as donated now?`, [
              { text: 'Cancel' },
              { text: 'Yes', onPress: () => markDonorDonated(item.id) },
            ]);
          }}>
            <Text style={{color:'white'}}>Mark Donated</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Blood Donor App (District-based)</Text>

      <Text style={styles.subtitle}>Register / Update Donor</Text>
      <TextInput placeholder="Name" value={name} onChangeText={setName} style={styles.input} />
      <TextInput placeholder="Contact number (+91...)" value={contactNumber} onChangeText={setContactNumber} style={styles.input} />
      <View style={styles.row}>
        <Text style={{alignSelf:'center'}}>Blood</Text>
        <Picker selectedValue={bloodType} style={styles.picker} onValueChange={setBloodType}>
          {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(bt => <Picker.Item key={bt} label={bt} value={bt} />)}
        </Picker>
      </View>

      <View style={styles.row}>
        <Text style={{alignSelf:'center'}}>District</Text>
        <Picker selectedValue={district} style={styles.picker} onValueChange={setDistrict}>
          {districts.map(d => <Picker.Item key={d} label={d} value={d} />)}
        </Picker>
      </View>

      <TextInput placeholder="Last donation date (YYYY-MM-DD) — optional" value={lastDonationDate} onChangeText={setLastDonationDate} style={styles.input} />

      <Button title="Save Donor" onPress={registerDonor} />

      <View style={{height:1, backgroundColor:'#ddd', marginVertical:12}} />

      <Text style={styles.subtitle}>Search Donors by District & Blood Type</Text>
      <View style={styles.row}>
        <Picker selectedValue={searchBloodType} style={styles.picker} onValueChange={setSearchBloodType}>
          {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(bt => <Picker.Item key={bt} label={bt} value={bt} />)}
        </Picker>

        <Picker selectedValue={searchDistrict} style={[styles.picker, {flex:1}]} onValueChange={setSearchDistrict}>
          {districts.map(d => <Picker.Item key={d} label={d} value={d} />)}
        </Picker>
      </View>

      <Button title={loading ? 'Searching...' : 'Search'} onPress={searchDonors} disabled={loading} />

      <FlatList data={results} keyExtractor={i => i.id} renderItem={renderDonor} style={{marginTop:10}} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 48, backgroundColor: '#fff', flex: 1 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  subtitle: { fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 8, marginBottom: 8, borderRadius: 6 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  picker: { flex: 1, height: 44 },
  resultRow: { flexDirection: 'row', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginBottom: 8 },
  resultName: { fontWeight: '700' },
  contactBtn: { backgroundColor: '#e53935', padding: 8, borderRadius: 6, marginBottom: 6 },
  markBtn: { padding: 8, borderRadius: 6 },
});
