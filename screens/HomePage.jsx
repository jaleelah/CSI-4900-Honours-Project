import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
} from "react-native";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../components/firebase";
import Header from "../components/Header";
import styles from "../styles/HomePageStyles";
import { useNavigation } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import {
  addJournalEntry,
  getJournalEntries,
  handleSavePromptEntry,
} from "../functions/JournalFunctions";
import prompts from "../assets/prompts";
import quotes from "../assets/Quotes";
import { useJournalContext } from "../components/EntryDatesContext"; // Import the context
import { useEntryDates } from "../components/EntryDatesContext"; // Import context
import { utcToZonedTime, format } from "date-fns-tz";
import { formatDateToTimezone } from "../utils/DateUtils";
const SearchBar = () => (
  <View style={styles.searchBar}>
    <TextInput
      style={styles.searchInput}
      placeholder="Search Past Entries?"
      placeholderTextColor="#555"
    />
    <TouchableOpacity>
      <Text style={styles.closeButton}>×</Text>
    </TouchableOpacity>
  </View>
);

const getRandomQuote = () => {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  return quotes[randomIndex];
};

const HomePage = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { entryDates, setEntryDates, journalEntries, setJournalEntries } = useEntryDates(); // Use global state

  const [viewJournalModalVisible, setViewJournalModalVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(getRandomQuote());
  const [newEntryText, setNewEntryText] = useState("");
  const [newEntryTitle, setNewEntryTitle] = useState("");
  const [createEntryModalVisible, setCreateEntryModalVisible] = useState(false);
  const [newEntryDate, setNewEntryDate] = useState(""); // New state for the selected date

  // Helper function to reset newEntryDate to today's date
  const resetToTodayDate = () => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).format(new Date()); // Format to YYYY-MM-DD
    setNewEntryDate(today); // Set today's date
  };

const fetchEntries = useCallback(async () => {
  try {
    setLoading(true);
    const entries = await getJournalEntries();

    // Extract journal dates directly as strings
    const dates = entries.map((entry) => entry.journalDate); // Use journalDate directly

    setJournalEntries(entries);
    setEntryDates(dates); // Store dates as strings
  } catch (error) {
    console.error("Error fetching journal entries:", error.message);
  } finally {
    setLoading(false);
  }
}, [setEntryDates, setJournalEntries]);

useEffect(() => {
  const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser || null);
  });

  const selectedDate = route.params?.selectedDate; // Access navigation parameter
  if (selectedDate) {
    setNewEntryDate(selectedDate); // Set the date to the selected date
    setCreateEntryModalVisible(true); // Open the create modal
  }

  fetchEntries();

  return () => {
    unsubscribeAuth();
  };
}, [fetchEntries, route.params?.selectedDate]);



const handleSaveEntry = async () => {
  const today = new Date();
  const currentDate = today.toISOString().split("T")[0]; // Format as YYYY-MM-DD

  // Prevent saving entries for future dates
  if (displayedDate > currentDate) {
    alert("You cannot create journal entries for future dates.");
    return;
  }

  if (newEntryTitle.trim() && newEntryText.trim()) {
    try {
      await addJournalEntry(newEntryText, newEntryTitle, displayedDate);

      // Fetch updated entries and update context
      const updatedEntries = await getJournalEntries();
      setJournalEntries(updatedEntries);

      // Add the new entry date to entryDates if not already present
      setEntryDates((prevDates) =>
        prevDates.includes(displayedDate) ? prevDates : [...prevDates, displayedDate]
      );

      // Reset the input fields and close the modal
      setNewEntryTitle("");
      setNewEntryText("");
      closeModal();

      // Navigate back to the home page
      navigation.navigate("Tabs", { screen: "Home" });
    } catch (error) {
      console.error("Error saving entry:", error.message);
    }
  } else {
    alert("Please provide both a title and content before saving.");
  }
};




  const closeModal = () => {
    setCreateEntryModalVisible(false);
  };

  const contentData = [
    {
      id: "greeting",
      component: (
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingText}>
            Hello, {user?.displayName ? user.displayName.split(" ")[0] : "User"}
          </Text>
          <TouchableOpacity
            style={styles.profileContainer}
            onPress={() => navigation.navigate("Settings")}
          >
            <Text style={styles.profileText}>
              {user?.displayName ? user.displayName.charAt(0).toUpperCase() : "U"}
            </Text>
          </TouchableOpacity>
        </View>
      ),
    },
    { id: "search", component: <SearchBar /> },
    { id: "title", component: <Title quote={quote} /> },
    {
      id: "pastEntries",
      component: (
        <PastEntries
          openViewJournalModal={setViewJournalModalVisible}
          journalEntries={journalEntries}
          loading={loading}
        />
      ),
    },
    {
      id: "createEntry",
      component: (
        <CreateJournalEntry
          newEntryText={newEntryText}
          setNewEntryText={setNewEntryText}
          newEntryTitle={newEntryTitle}
          newEntryDate={newEntryDate} // Pass the selected or default date
          setNewEntryTitle={setNewEntryTitle}
          modalVisible={createEntryModalVisible}
          setModalVisible={setCreateEntryModalVisible}
          handleSaveEntry={handleSaveEntry}
          newEntryDate={newEntryDate}
          onResetToTodayDate={resetToTodayDate} // Pass down the reset function

        />
      ),
    },

  ];

  return (
    <View style={styles.container}>
      <Header />
      <FlatList
        data={contentData}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => item.component}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};


const CreateJournalEntry = ({
  modalVisible,
  setModalVisible,
  newEntryDate, // New prop added for selected or default date
  onResetToTodayDate, // Renamed to explicitly indicate it
}) => {
  const navigation = useNavigation(); // Access navigation directly
  const { entryDates, setEntryDates, setJournalEntries } = useEntryDates(); // Pull from context
  const [currentModal, setCurrentModal] = useState("main");
  const [newEntryText, setNewEntryText] = useState("");
  const [newEntryTitle, setNewEntryTitle] = useState("");
  const [promptResponses, setPromptResponses] = useState(Array(5).fill(""));
  const [promptEntryTitle, setPromptEntryTitle] = useState("");
  const [randomPrompts, setRandomPrompts] = useState([]);
  const fadeAnim = useRef(new Animated.Value(1)).current;


   // Determine the displayed date
   const displayedDate = newEntryDate; // Always use the prop value


  const fadeTransition = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const switchModal = (type) => {
    fadeTransition();
    setTimeout(() => setCurrentModal(type), 200);
  };

  const closeModal = () => {
    setModalVisible(false);
    setCurrentModal("main");
  };

  const openPromptsModal = () => {
    const shuffledPrompts = prompts.sort(() => 0.5 - Math.random()).slice(0, 5);
    setRandomPrompts(shuffledPrompts);
    switchModal("usePrompts");
  };

const savePromptEntry = async () => {
  if (promptEntryTitle.trim() && promptResponses.some((response) => response.trim())) {
    try {
      const filteredResponses = promptResponses.filter((response) => response.trim());
      const entryText = filteredResponses.join("\n\n");

      await addJournalEntry(entryText, promptEntryTitle, displayedDate);

      // Fetch updated entries and update context
      const updatedEntries = await getJournalEntries();
      setJournalEntries(updatedEntries);

      // Add the new entry date to entryDates if not already present
      setEntryDates((prevDates) =>
        prevDates.includes(displayedDate) ? prevDates : [...prevDates, displayedDate]
      );

      setPromptResponses(Array(5).fill(""));
      setPromptEntryTitle("");
      closeModal();
      navigation.navigate("Home"); // Navigate back to Home
    } catch (error) {
      console.error("Error saving prompt entry:", error.message);
    }
  } else {
    alert("Please provide a title and at least one response.");
  }
};

const handleSaveEntry = async () => {
  if (newEntryTitle.trim() && newEntryText.trim()) {
    try {
      await addJournalEntry(newEntryText, newEntryTitle, displayedDate);

      // Fetch updated entries and update context
      const updatedEntries = await getJournalEntries();
      setJournalEntries(updatedEntries);

      // Add the new entry date to entryDates if not already present
      setEntryDates((prevDates) =>
        prevDates.includes(displayedDate) ? prevDates : [...prevDates, displayedDate]
      );

      // Reset the input fields and close the modal
      setNewEntryTitle("");
      setNewEntryText("");
      closeModal();

      // Navigate back to the home page
      navigation.navigate("Tabs", { screen: "Home" });
    } catch (error) {
      console.error("Error saving entry:", error.message);
    }
  } else {
    alert("Please provide both a title and content before saving.");
  }
};


  return (
    <View style={styles.createEntryContainer}>
      <Image source={require("../assets/cat.png")} style={styles.cat} />
      <Text style={styles.createEntryText}>Create a New Journal Entry</Text>
      <View style={styles.buttonAndCraneContainer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            onResetToTodayDate(); // Reset date to today using the parent-provided function
            setModalVisible(true); // Open the modal
          }}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
        <Image source={require("../assets/crane.png")} style={styles.crane} />
      </View>

      {/* Unified Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Animated.View style={[styles.modalContent, { opacity: fadeAnim }]}>
            <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
            {currentModal === "main" && (
              <>
                <Text style={styles.modalTitle}>
                  How would you like to journal today?
                </Text>
                <TouchableOpacity
                  style={styles.journalOption}
                  onPress={() => switchModal("writeFreely")}
                >
                  <Text style={styles.optionTitle}>Write Freely</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.journalOption}
                  onPress={openPromptsModal}
                >
                  <Text style={styles.optionTitle}>Use Prompts</Text>
                </TouchableOpacity>
              </>
            )}
            {currentModal === "writeFreely" && (
              <>
                <Text style={styles.modalTitle}>Dear diary...</Text>

                {/* Display Selected or Today's Date */}
                <Text style={styles.dateText}>{displayedDate}</Text>

                <TextInput
                  style={styles.titleInputBox}
                  placeholder="Name your journal entry"
                  value={newEntryTitle}
                  onChangeText={setNewEntryTitle}
                />
                <TextInput
                  style={styles.textInputBox}
                  placeholder="Write your thoughts here..."
                  multiline={true}
                  value={newEntryText}
                  onChangeText={setNewEntryText}
                />
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={handleSaveEntry}
                >
                  <Text style={styles.continueButtonText}>Save Entry</Text>
                </TouchableOpacity>
              </>
            )}
            {currentModal === "usePrompts" && (
              <>
                <Text style={styles.modalTitle}>Need a little inspiration?</Text>

                {/* Display Selected or Today's Date */}
                <Text style={styles.dateText}>{displayedDate}</Text>
                <Text style={styles.textBoxTitle}>Journal Title</Text>
                <TextInput
                  style={styles.titleInputBox}
                  placeholder="Name your journal entry"
                  value={promptEntryTitle}
                  onChangeText={setPromptEntryTitle}
                />
                <ScrollView contentContainerStyle={styles.scrollContent}>
                  {randomPrompts.map((prompt, index) => (
                    <View key={index} style={styles.promptContainer}>
                      <Text style={styles.textBoxTitle}>{prompt}</Text>
                      <TextInput
                        style={styles.textInputBox}
                        placeholder="Write your answer here..."
                        multiline={true}
                        value={promptResponses[index]}
                        onChangeText={(text) => {
                          const updatedResponses = [...promptResponses];
                          updatedResponses[index] = text;
                          setPromptResponses(updatedResponses);
                        }}
                      />
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={savePromptEntry}
                >
                  <Text style={styles.continueButtonText}>Save Entry</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const Title = ({ quote }) => (
  <View style={styles.titleContainer}>
    <Text style={styles.titleText}>Let’s Start Journaling</Text>
    <Text style={styles.subtitle}>Shall we?</Text>
    <Image source={require("../assets/shelf.png")} style={styles.shelf} />
    <Text style={styles.quote}>“{quote}”</Text>
  </View>
);

const PastEntries = ({ openViewJournalModal, journalEntries, loading }) => {
  if (loading) {
    return <Text style={styles.loadingText}>Loading entries...</Text>;
  }

  if (!journalEntries.length) {
    return <Text style={styles.emptyText}>No journal entries yet.</Text>;
  }

  // Ensure journalDate is consistently parsed as a Date object for sorting
  const recentEntries = journalEntries
    .filter((entry) => entry.journalDate) // Ensure the entry has a valid date
    .sort((a, b) => new Date(b.journalDate) - new Date(a.journalDate)) // Sort by journalDate (descending)
    .slice(0, 4); // Get the 4 most recent entries

  return (
    <View style={styles.pastEntries}>
      <Text style={styles.pastEntriesTitle}>Past Entries</Text>
      <View style={styles.entryContainer}>
        {recentEntries.map((entry) => (
          <TouchableOpacity
            key={entry.id}
            style={styles.entryButton}
            onPress={() => openViewJournalModal(entry)}
          >
            <Text style={styles.entryText}>
              {entry.entryTitle || "Untitled Entry"}
            </Text>
            <Text style={styles.dateText}>
              {new Date(entry.journalDate).toISOString().split("T")[0] || "No Date"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};


export default HomePage;