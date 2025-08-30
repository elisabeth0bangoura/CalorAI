import { useLocalSearchParams, useRouter } from "expo-router";
import 'moment/locale/de';
import { useEffect, useRef, useState } from 'react';

import { StatusBar } from "expo-status-bar";
import { ArrowRight } from 'lucide-react-native';
import { Keyboard, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { height, size, width } from 'react-native-responsive-sizes';






export default function SignUp2() {

 const router = useRouter(); // 👈 Das brauchst du
 const { Phonenumber,  method, Email, UserName} = useLocalSearchParams();
  

    
    

 const animation = useRef(null);

 const [NewEmail, setNewEmail] = useState("")
 const [Password, setPassword] = useState("")
 const [Firstname, setFirstname] = useState("")
 const [Lastname, setLastname] = useState("")
 
     


const fullText = "Tell us your email address and create a new password.";

const [displayedText, setDisplayedText] = useState("");



useEffect(() => {
  let index = 0;
  let currentText = "";
  const intervalRef = setInterval(() => {
    currentText += fullText[index];
    setDisplayedText(currentText);
    index++;
    if (index >= fullText.length) {
      clearInterval(intervalRef);
    }
  }, 50);

  return () => clearInterval(intervalRef); // cleanup falls Component unmountet
}, []);









 const handleEmail = (text) => {
    setNewEmail(text);
 };
      

 const handlePassword = (text) => {
    setPassword(text);
 };
      


 
 const handleFirstname = (text) => {
    setFirstname(text);
 };
      


 
 const handleLastname = (text) => {
    setLastname(text);
 };
    








  return (
  
  <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false} style={{
    backgroundColor: "#fff",
    height: "100%", width: "100%"
  }}>
      <View style={{ height: "100%", width: "100%", backgroundColor: '#fff' }}>
 <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={{ flex: 1, alignItems: 'center', backgroundColor: '#fff' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
     










  <Text style={{
   fontSize: size(20),
    marginTop: height(9),
    marginLeft: width(5),
    width: width(80),
   
    color: '#000',
    zIndex: 1000,
 fontFamily: 'Righteous-Regular',
  }}>
Almost there!


  </Text>



<View style={{
    height: 70,
    width: "90%",
}}>


 <Text style={{
    fontSize: size(16),
    marginTop: height(2),
    marginLeft: width(5),
    width: width(70),

   
    color: '#222',
    zIndex: 1000,
   fontFamily: "Open-Sans",
  }}>
 {displayedText}
  </Text>

</View>





{
   method == "apple" || method == "google"

   ?


<>

<TextInput placeholder='Firstname' 
   placeholderTextColor="#000"
  onChangeText={handleFirstname}
  keyboardType="default"
style={{
    borderWidth: 1,
    borderColor: '#222',
    width: "90%",
      fontSize: size(16),
    alignSelf: 'center',
    marginTop: height(2),
    textAlign: 'center',
    borderRadius: 10,
    height: height(6),
    paddingHorizontal: width(5)
}} />




<TextInput placeholder='Lastname' 
   placeholderTextColor="#000"
  onChangeText={handleLastname}
  keyboardType="default"
style={{
    borderWidth: 1,
    borderColor: '#222',
       width: "90%",
    fontSize: size(16),
    alignSelf: 'center',
    marginTop: height(2),
    textAlign: 'center',
    borderRadius: 10,
    height: height(6),
    paddingHorizontal: width(5)
}} />

</>



:



<View style={{
  flexDirection: 'row',
  alignSelf: 'center'
}}>


<TextInput placeholder='Firstname' 
   placeholderTextColor="#000"
  onChangeText={handleFirstname}
  keyboardType="default"
style={{
    borderWidth: 1,
    borderColor: '#222',
    width: width(45),
      fontSize: size(16),
    alignSelf: 'center',
    marginTop: height(2),
    textAlign: 'center',
    borderRadius: 10,
    height: height(6),
    paddingHorizontal: width(5)
}} />




<TextInput placeholder='Lastname' 
   placeholderTextColor="#000"
  onChangeText={handleLastname}
  keyboardType="default"
style={{
    borderWidth: 1,
    borderColor: '#222',
    width: width(45),
    fontSize: size(16),
    alignSelf: 'center',
    marginTop: height(2),
    textAlign: 'center',
    borderRadius: 10,
    height: height(6),
    paddingHorizontal: width(5)
}} />

</View>



}






{
 method == "apple" || method == "google"

 ?

 null

 :

  <TextInput placeholder='richardhendricks@gmail.com' 
 keyboardType="email-address"
    placeholderTextColor="#000"
      autoCapitalize="none"   // ✅ disables auto-capitalization
  onChangeText={(text) => handleEmail(text.toLowerCase())} // ✅ force lowercase
    style={{
    borderWidth: 1,
    borderColor: '#222',
    width: width(90),
    alignSelf: 'center',
    textAlign: 'center',
    marginTop: height(2),
    borderRadius: 10,
    height: height(6),
    fontSize: size(16),
    paddingHorizontal: width(5)
}} />
}









{
 method == "apple" || method == "google"

 ?

 null

 :



<TextInput placeholder='Create Password' 
   placeholderTextColor="#000"
  onChangeText={handlePassword}
  keyboardType="default"
  secureTextEntry={true}
style={{
    borderWidth: 1,
    borderColor: '#222',
    width: width(90),
      fontSize: size(16),
    alignSelf: 'center',
    marginTop: height(2),
    textAlign: 'center',
    borderRadius: 10,
    height: height(6),
    paddingHorizontal: width(5)
}} />


}












<TouchableOpacity onPress={() =>  {

router.push({
  pathname: "/(auth)/signUp3",
  params: { 
    Email: Email || NewEmail, 
    Phonenumber: Phonenumber,
    method:method, 
    Password: Password,
    UserName: Firstname + " " + Lastname,
  },
}); 
}} //disabled={PhoneNumber == "" ||PhoneNumber == null ? true : false}
style={{
  paddingVertical: 20,
  paddingHorizontal: 40,
  bottom: height(8),
  justifyContent: 'center',
  alignItems: 'center',
  position: 'absolute',
//  opacity: PhoneNumber == "" ||PhoneNumber == null ? 0.4 : 9, 
  right: width(5),
 marginLeft: width(5),
    flexDirection: 'row',
  borderRadius: 10,
  backgroundColor: '#000',

shadowColor: "#000",
shadowOffset: {
    width: 0,
    height: 3,
},
shadowOpacity: 0.14,
shadowRadius: 8.27,

elevation: 10,
}}>
  <Text style={{
    fontSize: size(16),
    fontFamily: 'Righteous-Regular',
    color: '#fff',
   
  }}>
    Next
  </Text>


  <ArrowRight color={"#fff"}  size={size(22)} style={{
    marginLeft: width(2),
  }} />

</TouchableOpacity>






</KeyboardAvoidingView>
</View>

</TouchableWithoutFeedback>



  );
}
