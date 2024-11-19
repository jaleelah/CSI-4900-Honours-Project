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
  Alert,
  ActivityIndicator
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
  deleteJournalEntry,
  updateEntryInFirestore,
} from "../functions/JournalFunctions";
import prompts from "../assets/prompts";
import quotes from "../assets/Quotes";
import { useJournalContext } from "../components/EntryDatesContext"; // Import the context
import { useEntryDates } from "../components/EntryDatesContext"; // Import context
import { utcToZonedTime, format } from "date-fns-tz";
import { formatDateToTimezone } from "../utils/DateUtils";
import EditJournalEntryModal from "../screens/EditJournalEntryModal";
import LoadingFlower from '../components/LoadingFlower';
import { getJournalEntries } from "../functions/JournalFunctions";

const [allEntries, setAllEntries] = useState([]);
const [data, setData] = useState([]);
const [isLoading, setIsLoading] = useState(false);
const [searchQuery, setSearchQuery] = useState("");

useEffect(() => {
  setIsLoading(true);
  getJournalEntries();
  setIsLoading(false);
}, []);

const handleSearch = (query) => {
  setSearchQuery(query);
}

if(isLoading) {
  return (
    <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
      <ActivityIndicator size ={'large'} color="#5500dc" />
    </View>
  )
}

const SearchBar = () => (
  <SafeAreaView style={styles.searchBar}>
    <TextInput
      style={{ // should probably move this for reusability later
        paddingHorizontal:20,
        paddingVertical:10,
        bordeColor:'#ccc',
        borderWidth:1,
        borderRadius:8}}
      placeholder="Search Past Entries?"
      placeholderTextColor="#555"
      clearButtonMode='always'
      autoCapitalize='none'
      autoCorrect={false}
      value={searchQuery}
      onChangeText={(query) => handleSearch(query)}
    />
    <FlatList>
      data={data}
      keyExtractor={(item) => item.entryTitle}
      renderItem={({item}) => (
        <View>
          <Text>{item.entryTitle} </Text>
        </View>
      )}
    </FlatList>
    <TouchableOpacity>
      <Text style={styles.closeButton}>×</Text>
    </TouchableOpacity>
  </SafeAreaView>
);

const getRandomQuote = () => {
  const randomIndex = Math.floor(Math.random() * quotes.length);
  return quotes[randomIndex];
};

const ViewJournalEntryModal = ({ entry, onClose, setJournalEntries, setEntryDates, setSelectedEntry, setEditModalVisible }) => {
  return (
    <Modal animationType="fade" transparent={true} visible={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>

            <ScrollView style={styles.scrollContentView}>
              <Text style={styles.modalTitle}>{entry.entryTitle}</Text>
              <Text style={styles.modalDateText}>{entry.journalDate}</Text>

                {entry.type === "free" ? (
                  <View style={styles.promptResponseContainer}>
                    <Text style={styles.responseText}>{entry.entryText || "No content available"}</Text>
                  </View>
                    ) : Array.isArray(entry.entryText) ? (
                      entry.entryText.map((item, index) => (
                        <View key={index} style={styles.promptContainer}>
                          {/* Prompt as a standalone title */}
                          <Text style={styles.textBoxTitle}>{item.prompt}</Text>
                          {/* Response in its own box */}
                          <View style={styles.responseBox}>
                            <Text style={styles.responseText}>
                              {item.response || "No response provided"}
                            </Text>
                          </View>
                        </View>
                      ))
                ) : (
                  <Text style={styles.modalViewText}>No prompts available</Text>
                )}


            </ScrollView>

          <View style={styles.fixedButtonsContainer}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                setSelectedEntry(entry); // Set the entry to be edited
                setEditModalVisible(true); // Open the edit modal
                onClose(); // Close the view modal
              }}
            >
              <Text style={styles.continueButtonText}>Edit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => {
                Alert.alert(
                  "Confirm Deletion",
                  "Are you sure you want to delete this journal entry? This action cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Yes, Delete",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          // Call delete function and remove from Firestore
                          await deleteJournalEntry(entry.id);

                          // Update the journal entries state to reflect deletion
                          setJournalEntries((prevEntries) =>
                            prevEntries.filter((e) => e.id !== entry.id)
                          );

                          // Update the entry dates state
                          setEntryDates((prevDates) =>
                            prevDates.filter((date) => date !== entry.journalDate)
                          );

                          // Close the modal
                          onClose();

                          console.log("Journal entry deleted successfully.");
                        } catch (error) {
                          console.error("Error deleting journal entry:", error.message);
                        }
                      },
                    },
                  ]
                );
              }}
            >
              <Text style={styles.continueButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const HomePage = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { entryDates, setEntryDates, journalEntries, setJournalEntries } = useEntryDates(); // Use global state
  const [viewJournalEntry, setViewJournalEntry] = useState(null); // State to hold the selected journal entry
  const [viewJournalModalVisible, setViewJournalModalVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(getRandomQuote());
  const [newEntryText, setNewEntryText] = useState("");
  const [newEntryTitle, setNewEntryTitle] = useState("");
  const [createEntryModalVisible, setCreateEntryModalVisible] = useState(false);
  const [newEntryDate, setNewEntryDate] = useState(""); // New state for the selected date
  const [editModalVisible, setEditModalVisible] = useState(false); // Controls visibility of edit modal
  const [selectedEntry, setSelectedEntry] = useState(null); // Stores the entry being edited


  // Helper function to reset newEntryDate to today's date
  const resetToTodayDate = () => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).format(new Date()); // Format to YYYY-MM-DD
    setNewEntryDate(today); // Set today's date
  };

  const handleOpenJournal = (entry) => {
    setViewJournalEntry(entry); // Set the clicked journal entry
    setViewJournalModalVisible(true); // Open the modal
  };

  const handleCloseJournal = () => {
    setViewJournalModalVisible(false); // Close the modal
    setViewJournalEntry(null); // Clear the selected entry
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
    if (currentUser) {
      setUser(currentUser); // Set the authenticated user
      console.log("Authenticated user UID:", currentUser.uid); // Log the UID for debugging or usage
    } else {
      setUser(null);
      console.error("User is not authenticated."); // Handle unauthenticated state
    }
  });

  // Check if a journal entry is passed from navigation
  if (route.params?.viewJournalEntry) {
    setViewJournalEntry(route.params.viewJournalEntry); // Set the entry for the modal
    setViewJournalModalVisible(true); // Open the modal
  }

  // Check for creating a new entry date
  if (route.params?.selectedDate) {
    setNewEntryDate(route.params.selectedDate); // Set the selected date for the new entry
    setCreateEntryModalVisible(true); // Open the modal for creating an entry
  }

  // Fetch existing journal entries for the authenticated user
  fetchEntries();

  // Cleanup the authentication listener on component unmount
  return () => {
    unsubscribeAuth();
  };
}, [fetchEntries, route.params]);



const handleSaveEntry = async () => {
  if (newEntryTitle.trim() && newEntryText.trim()) {
    try {
      // Check if an entry already exists for the selected date using entryDates
      if (entryDates.includes(newEntryDate)) {
        alert("A journal entry already exists for this date. You cannot create another one.");
        return; // Stop the process if the date already has an entry
      }

      // Proceed with saving the journal entry
      await addJournalEntry(newEntryText, newEntryTitle, newEntryDate);

      // Fetch updated entries and update context
      const updatedEntries = await getJournalEntries();
      setJournalEntries(updatedEntries);

      // Add the new entry date to entryDates if not already present
      setEntryDates((prevDates) =>
        prevDates.includes(newEntryDate) ? prevDates : [...prevDates, newEntryDate]
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
          openViewJournalModal={handleOpenJournal} // Pass the callback
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
      {/* View Journal Entry Modal */}
        {viewJournalModalVisible && viewJournalEntry && (
          <ViewJournalEntryModal
            entry={viewJournalEntry}
            onClose={handleCloseJournal}
            setJournalEntries={setJournalEntries}
            setEntryDates={setEntryDates}
            setSelectedEntry={setSelectedEntry} // Pass setSelectedEntry
            setEditModalVisible={setEditModalVisible} // Pass setEditModalVisible
          />
        )}

        {editModalVisible && selectedEntry && (
          <EditJournalEntryModal
            entry={selectedEntry}
            onClose={() => setEditModalVisible(false)}
            onSave={updateEntryInFirestore} // Correctly pass the onSave function here
            setJournalEntries={setJournalEntries} // Pass the state updater
          />
        )}

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
  try {
    // Validate title and responses
    if (!promptEntryTitle.trim()) {
      alert("Please provide a title for your journal entry.");
      return;
    }
    if (!promptResponses.some((response) => response.trim())) {
      alert("Please provide at least one response to the prompts.");
      return;
    }

    // Check if an entry already exists for the selected date
    if (entryDates.includes(displayedDate)) {
      alert("A journal entry already exists for this date. You cannot create another one.");
      return;
    }

    // Combine prompts and responses into an array of objects, filtering out empty responses
    const promptsData = randomPrompts
      .map((prompt, index) => ({
        prompt,
        response: promptResponses[index]?.trim() || "", // Trim whitespace from responses
      }))
      .filter((item) => item.response); // Filter out prompts with empty responses

    // Log the data being saved for debugging
    console.log("Saving prompt-based journal entry with the following data:", {
      promptsData,
      promptEntryTitle,
      displayedDate,
      type: "prompts",
    });

    // Save the journal entry with the "prompts" type
    await addJournalEntry(promptsData, promptEntryTitle, displayedDate, "prompts");

    // Fetch updated entries and update the context
    const updatedEntries = await getJournalEntries();
    setJournalEntries(updatedEntries);

    // Add the new entry date to entryDates if not already present
    setEntryDates((prevDates) =>
      prevDates.includes(displayedDate) ? prevDates : [...prevDates, displayedDate]
    );

    // Reset the input fields and close the modal
    setPromptResponses(Array(5).fill(""));
    setPromptEntryTitle("");
    closeModal();

    navigation.navigate("Home"); // Navigate back to Home
    console.log("Prompt-based journal entry saved successfully.");
  } catch (error) {
    console.error("Error saving prompt entry:", error.message);
    alert("An error occurred while saving the journal entry. Please try again.");
  }
};


const handleSaveEntry = async () => {
  if (newEntryTitle.trim() && newEntryText.trim()) {
    try {
      // Check if an entry already exists for the selected date using entryDates
      if (entryDates.includes(newEntryDate)) {
        alert("A journal entry already exists for this date. You cannot create another one.");
        return; // Stop the process if the date already has an entry
      }

      // Proceed with saving the journal entry as "free"
      await addJournalEntry(newEntryText, newEntryTitle, newEntryDate, "free");

      // Fetch updated entries and update context
      const updatedEntries = await getJournalEntries();
      setJournalEntries(updatedEntries);

      // Add the new entry date to entryDates if not already present
      setEntryDates((prevDates) =>
        prevDates.includes(newEntryDate) ? prevDates : [...prevDates, newEntryDate]
      );

      // Reset the input fields and close the modal
      setNewEntryTitle("");
      setNewEntryText("");
      closeModal();

      navigation.navigate("Home"); // Navigate back to the home page
      console.log("Free-writing journal entry saved successfully.");
    } catch (error) {
      console.error("Error saving entry:", error.message);
      alert("An error occurred while saving the journal entry. Please try again.");
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
      return <LoadingFlower />;
    }

  if (!journalEntries.length) {
    return <Text style={styles.emptyText}>No journal entries yet.</Text>;
  }

  const recentEntries = journalEntries
    .filter((entry) => entry.journalDate)
    .sort((a, b) => new Date(b.journalDate) - new Date(a.journalDate))
    .slice(0, 4);

  return (
    <View style={styles.pastEntries}>
      <Text style={styles.pastEntriesTitle}>Past Entries</Text>
      <View style={styles.entryContainer}>
        {recentEntries.map((entry) => (
          <TouchableOpacity
            key={entry.id}
            style={styles.entryButton}
            onPress={() => openViewJournalModal(entry)} // Pass the entry to the callback
          >
            <Text style={styles.entryText}>
              {entry.entryTitle || "Untitled Entry"}
            </Text>
            <Text style={styles.dateText}>
              {entry.journalDate || "No Date"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};



export default HomePage;