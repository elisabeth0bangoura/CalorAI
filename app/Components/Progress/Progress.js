

import { StyleSheet, View } from "react-native";
import AppBlurHeader from "../../AppBlurHeader";
import { useSheets } from "../../Context/SheetsContext";



export default function Progress() {
  const { register, present, dismiss, dismissAll } = useSheets()
  const s = { padding: 16, gap: 12 }

    const {
      isS2Open, setIsS2Open,
      isS3Open, setIsS3Open
    } = useSheets()
  



  return (
   
   <View style={{
    backgroundColor: "#fff",
    height: "100%",
    width: "100%"
   }}>




<AppBlurHeader />





</View>


  )
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 10,
  },
  card: {
    marginBottom: 20,
    borderRadius: 10,
    backgroundColor: "#f9f9f9",
    padding: 10,
    elevation: 2,
  },
  image: {
    width: "100%",
    height: 180,
    borderRadius: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 10,
  },
  text: {
    fontSize: 14,
    marginTop: 4,
  },
});