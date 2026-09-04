import { firebaseConfig } from "./firebase-config.js";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

/*
 * Inizializzazione Firebase
 */

function isFirebaseConfigured() {
  return [
    firebaseConfig.apiKey,
    firebaseConfig.authDomain,
    firebaseConfig.projectId,
    firebaseConfig.messagingSenderId,
    firebaseConfig.appId
  ].every(value => {
    return value && !String(value).startsWith("INSERISCI_");
  });
}

const firebaseConfigured = isFirebaseConfigured();
const firebaseApp = firebaseConfigured
  ? initializeApp(firebaseConfig)
  : null;
const auth = firebaseApp ? getAuth(firebaseApp) : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;

/*
 * Stato dell'applicazione
 */

const state = {
  user: null,
  groupId: null,
  group: null,
  people: [],
  history: [],
  selectedPerson: null,
  unsubscribeGroup: null,
  unsubscribePeople: null,
  unsubscribeHistory: null
};

/*
 * Elementi HTML
 */

const elements = {
  app: document.querySelector("#app"),
  loadingScreen: document.querySelector("#loading-screen"),
  toast: document.querySelector("#toast"),

  homeScreen: document.querySelector("#home-screen"),
  groupScreen: document.querySelector("#group-screen"),

  groupNameInput: document.querySelector("#group-name"),
  inviteCodeInput: document.querySelector("#invite-code"),

  createGroupButton: document.querySelector("#create-group-button"),
  joinGroupButton: document.querySelector("#join-group-button"),
  leaveGroupButton: document.querySelector("#leave-group-button"),
  confirmLeaveGroupButton: document.querySelector(
    "#confirm-leave-group-button"
  ),

  currentGroupName: document.querySelector("#current-group-name"),
  coffeeUnitPrice: document.querySelector("#coffee-unit-price"),
  packSummary: document.querySelector("#pack-summary"),

  peopleList: document.querySelector("#people-list"),
  emptyPeople: document.querySelector("#empty-people"),

  historyList: document.querySelector("#history-list"),
  emptyHistory: document.querySelector("#empty-history"),

  counterTab: document.querySelector("#counter-tab"),
  historyTab: document.querySelector("#history-tab"),

  counterTabButton: document.querySelector("#counter-tab-button"),
  historyTabButton: document.querySelector("#history-tab-button"),
  inviteButton: document.querySelector("#invite-button"),
  priceButton: document.querySelector("#price-button"),

  openAddPersonButton: document.querySelector("#open-add-person-button"),
  addPersonModal: document.querySelector("#add-person-modal"),
  personNameInput: document.querySelector("#person-name"),
  addPersonButton: document.querySelector("#add-person-button"),

  priceModal: document.querySelector("#price-modal"),
  packPriceInput: document.querySelector("#pack-price"),
  capsuleCountInput: document.querySelector("#capsule-count"),
  calculatedUnitPrice: document.querySelector("#calculated-unit-price"),
  savePriceButton: document.querySelector("#save-price-button"),

  purchaseModal: document.querySelector("#purchase-modal"),
  purchaseMessage: document.querySelector("#purchase-message"),
  confirmPurchaseButton: document.querySelector(
    "#confirm-purchase-button"
  ),

  removePersonModal: document.querySelector("#remove-person-modal"),
  removePersonMessage: document.querySelector(
    "#remove-person-message"
  ),
  confirmRemovePersonButton: document.querySelector(
    "#confirm-remove-person-button"
  ),

  leaveGroupModal: document.querySelector("#leave-group-modal"),
  leaveGroupMessage: document.querySelector("#leave-group-message"),
  personDetailsModal: document.querySelector("#person-details-modal"),
  personDetailsTitle: document.querySelector("#person-details-title"),
  personDetailsCoffeeCount: document.querySelector(
    "#person-details-coffee-count"
  ),
  personDetailsBalance: document.querySelector(
    "#person-details-balance"
  ),
  personDetailsPurchases: document.querySelector(
    "#person-details-purchases"
  ),
  editPersonNameInput: document.querySelector("#edit-person-name"),
  savePersonNameButton: document.querySelector(
    "#save-person-name-button"
  ),
  openRemovePersonButton: document.querySelector(
    "#open-remove-person-button"
  )
};

/*
 * Formattazione
 */

const moneyFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR"
});

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

function formatMoney(cents) {
  return moneyFormatter.format((Number(cents) || 0) / 100);
}

function formatDate(timestamp) {
  if (!timestamp) {
    return "Adesso";
  }

  const date = timestamp.toDate
    ? timestamp.toDate()
    : new Date(timestamp);

  return dateFormatter.format(date);
}

function parseEuroToCents(value) {
  const normalized = String(value)
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");

  if (!normalized) {
    return null;
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return Math.round(amount * 100);
}

/*
 * Utilità
 */

function generateSecureCode() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, byte => {
    return byte.toString(16).padStart(2, "0");
  }).join("");
}

function generateId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return generateSecureCode();
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", isError);
  elements.toast.classList.remove("hidden");

  window.clearTimeout(showToast.timeout);

  showToast.timeout = window.setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 3000);
}

function setButtonLoading(button, loading, loadingText) {
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    return;
  }

  button.textContent =
    button.dataset.originalText || button.textContent;

  button.disabled = false;
}

function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

function showHomeScreen() {
  elements.groupScreen.classList.add("hidden");
  elements.homeScreen.classList.remove("hidden");
}

function showGroupScreen() {
  elements.homeScreen.classList.add("hidden");
  elements.groupScreen.classList.remove("hidden");
}

function showCounterTab() {
  elements.counterTab.classList.remove("hidden");
  elements.historyTab.classList.add("hidden");

  elements.counterTabButton.classList.add("active");
  elements.historyTabButton.classList.remove("active");
}

function showHistoryTab() {
  elements.counterTab.classList.add("hidden");
  elements.historyTab.classList.remove("hidden");

  elements.counterTabButton.classList.remove("active");
  elements.historyTabButton.classList.add("active");
}

function saveCurrentGroup(groupId) {
  localStorage.setItem("coffeeCounterGroupId", groupId);
}

function removeSavedGroup() {
  localStorage.removeItem("coffeeCounterGroupId");
}

function getSavedGroup() {
  return localStorage.getItem("coffeeCounterGroupId");
}

function stopListeners() {
  if (state.unsubscribeGroup) {
    state.unsubscribeGroup();
  }

  if (state.unsubscribePeople) {
    state.unsubscribePeople();
  }

  if (state.unsubscribeHistory) {
    state.unsubscribeHistory();
  }

  state.unsubscribeGroup = null;
  state.unsubscribePeople = null;
  state.unsubscribeHistory = null;
}

/*
 * Creazione gruppo
 */

async function createGroup() {
  const name = elements.groupNameInput.value.trim();

  if (!name) {
    showToast("Inserisci il nome del gruppo.", true);
    elements.groupNameInput.focus();
    return;
  }

  if (!state.user) {
    showToast("Autenticazione non disponibile.", true);
    return;
  }

  setButtonLoading(
    elements.createGroupButton,
    true,
    "Creazione..."
  );

  try {
    const groupId = generateId();
    const inviteCode = generateSecureCode();

    const groupReference = doc(db, "groups", groupId);
    const memberReference = doc(
      db,
      "groups",
      groupId,
      "members",
      state.user.uid
    );
    const inviteReference = doc(db, "invites", inviteCode);
    const historyReference = doc(
      collection(db, "groups", groupId, "history")
    );

    const batch = writeBatch(db);

    batch.set(groupReference, {
      name,
      ownerId: state.user.uid,
      inviteCode,
      packPriceCents: 0,
      capsuleCount: 0,
      coffeePriceCents: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    batch.set(memberReference, {
      uid: state.user.uid,
      joinedAt: serverTimestamp()
    });

    batch.set(inviteReference, {
      groupId,
      createdAt: serverTimestamp()
    });

    batch.set(historyReference, {
      type: "group-created",
      title: "Gruppo creato",
      detail: name,
      createdAt: serverTimestamp(),
      createdBy: state.user.uid
    });

    await batch.commit();

    saveCurrentGroup(groupId);
    await openGroup(groupId);

    showToast("Gruppo creato.");
  } catch (error) {
    console.error(error);
    showToast(
      "Non è stato possibile creare il gruppo.",
      true
    );
  } finally {
    setButtonLoading(
      elements.createGroupButton,
      false,
      "Creazione..."
    );
  }
}

/*
 * Ingresso nel gruppo
 */

async function joinGroup() {
  const inviteCode = elements.inviteCodeInput.value.trim();

  if (!inviteCode) {
    showToast("Inserisci il codice di invito.", true);
    elements.inviteCodeInput.focus();
    return;
  }

  if (!state.user) {
    showToast("Autenticazione non disponibile.", true);
    return;
  }

  setButtonLoading(
    elements.joinGroupButton,
    true,
    "Accesso..."
  );

  try {
    const inviteReference = doc(db, "invites", inviteCode);
    const inviteSnapshot = await getDoc(inviteReference);

    if (!inviteSnapshot.exists()) {
      showToast("Codice di invito non valido.", true);
      return;
    }

    const invite = inviteSnapshot.data();
    const groupId = invite.groupId;

    if (!groupId) {
      showToast("Invito non valido.", true);
      return;
    }

    const memberReference = doc(
      db,
      "groups",
      groupId,
      "members",
      state.user.uid
    );

    await setDoc(memberReference, {
      uid: state.user.uid,
      inviteCode,
      joinedAt: serverTimestamp()
    });

    await addDoc(
      collection(db, "groups", groupId, "history"),
      {
        type: "member-joined",
        title: "Un dispositivo è entrato nel gruppo",
        detail: "",
        createdAt: serverTimestamp(),
        createdBy: state.user.uid
      }
    );

    saveCurrentGroup(groupId);
    await openGroup(groupId);

    showToast("Sei entrato nel gruppo.");
  } catch (error) {
    console.error(error);

    if (error.code === "permission-denied") {
      showToast(
        "Codice non valido o accesso negato.",
        true
      );
    } else {
      showToast(
        "Non è stato possibile entrare nel gruppo.",
        true
      );
    }
  } finally {
    setButtonLoading(
      elements.joinGroupButton,
      false,
      "Accesso..."
    );
  }
}

/*
 * Apertura e sincronizzazione gruppo
 */

async function openGroup(groupId) {
  stopListeners();

  state.groupId = groupId;
  showGroupScreen();

  const groupReference = doc(db, "groups", groupId);

  state.unsubscribeGroup = onSnapshot(
    groupReference,
    snapshot => {
      if (!snapshot.exists()) {
        leaveGroup();
        showToast("Il gruppo non esiste più.", true);
        return;
      }

      state.group = {
        id: snapshot.id,
        ...snapshot.data()
      };

      renderGroup();
    },
    error => {
      console.error(error);
      leaveGroup();
      showToast("Non hai accesso a questo gruppo.", true);
    }
  );

  const peopleQuery = query(
    collection(db, "groups", groupId, "people"),
    orderBy("nameLowercase")
  );

  state.unsubscribePeople = onSnapshot(
    peopleQuery,
    snapshot => {
      state.people = snapshot.docs.map(personDocument => ({
        id: personDocument.id,
        ...personDocument.data()
      }));

      renderPeople();
    },
    error => {
      console.error(error);
      showToast(
        "Errore durante il caricamento delle persone.",
        true
      );
    }
  );

  const historyQuery = query(
    collection(db, "groups", groupId, "history"),
    orderBy("createdAt", "desc"),
    limit(200)
  );

  state.unsubscribeHistory = onSnapshot(
    historyQuery,
    snapshot => {
      state.history = snapshot.docs.map(historyDocument => ({
        id: historyDocument.id,
        ...historyDocument.data()
      }));

      renderHistory();
    },
    error => {
      console.error(error);
      showToast(
        "Errore durante il caricamento della cronologia.",
        true
      );
    }
  );
}

function leaveGroup() {
  const groupName = state.group?.name || "questo gruppo";

  stopListeners();

  state.groupId = null;
  state.group = null;
  state.people = [];
  state.history = [];
  state.selectedPerson = null;

  removeSavedGroup();

  renderPeople();
  renderHistory();
  showHomeScreen();
  showToast(`Sei uscito da ${groupName}.`);
}

/*
 * Visualizzazione gruppo
 */

function renderGroup() {
  if (!state.group) {
    return;
  }

  const packPriceCents = state.group.packPriceCents || 0;
  const capsuleCount = state.group.capsuleCount || 0;
  const coffeePriceCents = state.group.coffeePriceCents || 0;

  elements.currentGroupName.textContent =
    state.group.name || "Gruppo";

  elements.coffeeUnitPrice.textContent =
    formatMoney(coffeePriceCents);

  if (packPriceCents > 0 && capsuleCount > 0) {
    elements.packSummary.textContent =
      `${capsuleCount} capsule per ${formatMoney(packPriceCents)}`;
  } else {
    elements.packSummary.textContent =
      "Prezzo delle capsule non configurato";
  }
}

/*
 * Persone
 */

async function addPerson() {
  const name = elements.personNameInput.value.trim();

  if (!name) {
    showToast("Inserisci il nome della persona.", true);
    elements.personNameInput.focus();
    return;
  }

  if (!state.groupId) {
    return;
  }

  setButtonLoading(
    elements.addPersonButton,
    true,
    "Aggiunta..."
  );

  try {
    const personReference = doc(
      collection(db, "groups", state.groupId, "people")
    );

    const historyReference = doc(
      collection(db, "groups", state.groupId, "history")
    );

    const batch = writeBatch(db);

    batch.set(personReference, {
      name,
      nameLowercase: name.toLocaleLowerCase("it"),
      coffeeCount: 0,
      balanceCents: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: state.user.uid
    });

    batch.set(historyReference, {
      type: "person-added",
      title: `${name} è stato aggiunto`,
      detail: "",
      personId: personReference.id,
      createdAt: serverTimestamp(),
      createdBy: state.user.uid
    });

    await batch.commit();

    elements.personNameInput.value = "";
    closeModal(elements.addPersonModal);

    showToast("Persona aggiunta.");
  } catch (error) {
    console.error(error);
    showToast(
      "Non è stato possibile aggiungere la persona.",
      true
    );
  } finally {
    setButtonLoading(
      elements.addPersonButton,
      false,
      "Aggiunta..."
    );
  }
}

async function changeCoffee(person, amount) {
  if (!state.groupId || !state.group) {
    return;
  }

  const coffeePriceCents =
    Number(state.group.coffeePriceCents) || 0;

  if (coffeePriceCents <= 0) {
    showToast(
      "Configura prima il prezzo delle capsule.",
      true
    );

    openPriceModal();
    return;
  }

  const personReference = doc(
    db,
    "groups",
    state.groupId,
    "people",
    person.id
  );

  const historyReference = doc(
    collection(db, "groups", state.groupId, "history")
  );

  try {
    await runTransaction(db, async transaction => {
      const personSnapshot =
        await transaction.get(personReference);

      if (!personSnapshot.exists()) {
        throw new Error("La persona non esiste più.");
      }

      const currentPerson = personSnapshot.data();
      const currentCoffeeCount =
        Number(currentPerson.coffeeCount) || 0;

      const newCoffeeCount = currentCoffeeCount + amount;

      if (newCoffeeCount < 0) {
        return;
      }

      const balanceChange = coffeePriceCents * amount;

      transaction.update(personReference, {
        coffeeCount: newCoffeeCount,
        balanceCents: increment(balanceChange),
        updatedAt: serverTimestamp()
      });

      transaction.set(historyReference, {
        type: amount > 0
          ? "coffee-added"
          : "coffee-removed",

        title: amount > 0
          ? `Caffè aggiunto a ${currentPerson.name}`
          : `Caffè rimosso da ${currentPerson.name}`,

        detail:
          `${amount > 0 ? "+" : "-"}${formatMoney(coffeePriceCents)}`,

        amountCents: balanceChange,
        unitPriceCents: coffeePriceCents,
        personId: person.id,
        personName: currentPerson.name,
        createdAt: serverTimestamp(),
        createdBy: state.user.uid
      });
    });
  } catch (error) {
    console.error(error);
    showToast(
      error.message ||
      "Non è stato possibile aggiornare il caffè.",
      true
    );
  }
}

function openLeaveGroupModal() {
  const groupName = state.group?.name || "questo gruppo";

  elements.leaveGroupMessage.textContent =
    `Vuoi uscire da ${groupName}? Non verrà eliminato nessun dato condiviso, ` +
    "ma il gruppo non verrà più aperto automaticamente in questo browser.";

  openModal(elements.leaveGroupModal);
}

function openPersonDetails(person) {
  state.selectedPerson = person;

  const purchaseCount = state.history.filter(event => {
    return event.type === "capsules-purchased" && event.personId === person.id;
  }).length;

  elements.personDetailsTitle.textContent = person.name;
  elements.personDetailsCoffeeCount.textContent = String(
    person.coffeeCount || 0
  );
  elements.personDetailsBalance.textContent = formatMoney(
    person.balanceCents || 0
  );
  elements.personDetailsPurchases.textContent = String(purchaseCount);
  elements.editPersonNameInput.value = person.name || "";

  openModal(elements.personDetailsModal);
}

async function savePersonName() {
  const person = state.selectedPerson;
  const name = elements.editPersonNameInput.value.trim();

  if (!person || !state.groupId) {
    return;
  }

  if (!name) {
    showToast("Inserisci un nome valido.", true);
    elements.editPersonNameInput.focus();
    return;
  }

  if (name === person.name) {
    closeModal(elements.personDetailsModal);
    return;
  }

  setButtonLoading(
    elements.savePersonNameButton,
    true,
    "Salvataggio..."
  );

  try {
    const personReference = doc(
      db,
      "groups",
      state.groupId,
      "people",
      person.id
    );

    const historyReference = doc(
      collection(db, "groups", state.groupId, "history")
    );

    const batch = writeBatch(db);

    batch.update(personReference, {
      name,
      nameLowercase: name.toLocaleLowerCase("it"),
      updatedAt: serverTimestamp()
    });

    batch.set(historyReference, {
      type: "person-renamed",
      title: `${person.name} è stato rinominato`,
      detail: `Nuovo nome: ${name}`,
      personId: person.id,
      personName: name,
      createdAt: serverTimestamp(),
      createdBy: state.user.uid
    });

    await batch.commit();

    state.selectedPerson = {
      ...person,
      name,
      nameLowercase: name.toLocaleLowerCase("it")
    };

    closeModal(elements.personDetailsModal);
    showToast("Nome aggiornato.");
  } catch (error) {
    console.error(error);
    showToast("Non è stato possibile aggiornare il nome.", true);
  } finally {
    setButtonLoading(
      elements.savePersonNameButton,
      false,
      "Salvataggio..."
    );
  }
}

function askRemoveSelectedPerson() {
  const person = state.selectedPerson;

  if (!person) {
    return;
  }

  closeModal(elements.personDetailsModal);
  askRemovePerson(person);
}

function askRemovePerson(person) {
  state.selectedPerson = person;

  elements.removePersonMessage.textContent =
    `Vuoi rimuovere ${person.name} dal gruppo?`;

  openModal(elements.removePersonModal);
}

async function removePerson() {
  const person = state.selectedPerson;

  if (!person || !state.groupId) {
    return;
  }

  setButtonLoading(
    elements.confirmRemovePersonButton,
    true,
    "Rimozione..."
  );

  try {
    const personReference = doc(
      db,
      "groups",
      state.groupId,
      "people",
      person.id
    );

    const historyReference = doc(
      collection(db, "groups", state.groupId, "history")
    );

    const batch = writeBatch(db);

    batch.delete(personReference);

    batch.set(historyReference, {
      type: "person-removed",
      title: `${person.name} è stato rimosso`,
      detail: `Saldo finale: ${formatMoney(
        person.balanceCents || 0
      )}`,
      personId: person.id,
      personName: person.name,
      createdAt: serverTimestamp(),
      createdBy: state.user.uid
    });

    await batch.commit();

    closeModal(elements.removePersonModal);
    state.selectedPerson = null;

    closeModal(elements.personDetailsModal);
    showToast("Persona rimossa.");
  } catch (error) {
    console.error(error);
    showToast(
      "Non è stato possibile rimuovere la persona.",
      true
    );
  } finally {
    setButtonLoading(
      elements.confirmRemovePersonButton,
      false,
      "Rimozione..."
    );
  }
}

function renderPeople() {
  elements.peopleList.replaceChildren();

  elements.emptyPeople.classList.toggle(
    "hidden",
    state.people.length !== 0
  );

  elements.peopleList.classList.toggle(
    "hidden",
    state.people.length === 0
  );

  for (const person of state.people) {
    const row = document.createElement("article");
    row.className = "person-row";

    const identity = document.createElement("button");
    identity.className = "person-identity";
    identity.type = "button";
    identity.setAttribute("aria-label", `Apri i dettagli di ${person.name}`);
    identity.addEventListener("click", () => {
      openPersonDetails(person);
    });

    const name = document.createElement("span");
    name.className = "person-name";
    name.textContent = person.name;

    const balance = document.createElement("span");
    balance.className = "person-balance";

    if ((person.balanceCents || 0) < 0) {
      balance.classList.add("negative");
    }

    balance.textContent =
      `Saldo: ${formatMoney(person.balanceCents || 0)}`;

    identity.append(name, balance);

    const heading = document.createElement("div");
    heading.className = "person-heading";
    heading.append(identity);

    const controls = document.createElement("div");
    controls.className = "person-controls";

    const removeCoffeeButton =
      document.createElement("button");

    removeCoffeeButton.className = "counter-button";
    removeCoffeeButton.type = "button";
    removeCoffeeButton.textContent = "−";
    removeCoffeeButton.disabled =
      (person.coffeeCount || 0) <= 0;

    removeCoffeeButton.setAttribute(
      "aria-label",
      `Rimuovi un caffè da ${person.name}`
    );

    removeCoffeeButton.addEventListener("click", () => {
      changeCoffee(person, -1);
    });

    const counter = document.createElement("div");
    counter.className = "coffee-count";

    const counterValue = document.createElement("strong");
    counterValue.textContent = String(person.coffeeCount || 0);

    const counterLabel = document.createElement("span");
    counterLabel.textContent = "caffè";

    counter.append(counterValue, counterLabel);

    const addCoffeeButton =
      document.createElement("button");

    addCoffeeButton.className = "counter-button add";
    addCoffeeButton.type = "button";
    addCoffeeButton.textContent = "+";

    addCoffeeButton.setAttribute(
      "aria-label",
      `Aggiungi un caffè a ${person.name}`
    );

    addCoffeeButton.addEventListener("click", () => {
      changeCoffee(person, 1);
    });

    const purchaseButton =
      document.createElement("button");

    purchaseButton.className = "purchase-button";
    purchaseButton.type = "button";
    purchaseButton.textContent = "Capsule";

    purchaseButton.addEventListener("click", () => {
      askRegisterPurchase(person);
    });

    controls.append(
      removeCoffeeButton,
      counter,
      addCoffeeButton,
      purchaseButton
    );

    row.append(heading, controls);
    elements.peopleList.append(row);
  }
}

/*
 * Prezzo capsule
 */

function openPriceModal() {
  const group = state.group || {};

  elements.packPriceInput.value =
    group.packPriceCents > 0
      ? (group.packPriceCents / 100)
          .toFixed(2)
          .replace(".", ",")
      : "";

  elements.capsuleCountInput.value =
    group.capsuleCount || "";

  updateCalculatedPrice();
  openModal(elements.priceModal);
}

function updateCalculatedPrice() {
  const packPriceCents =
    parseEuroToCents(elements.packPriceInput.value);

  const capsuleCount =
    Number(elements.capsuleCountInput.value);

  if (
    packPriceCents === null ||
    packPriceCents <= 0 ||
    !Number.isInteger(capsuleCount) ||
    capsuleCount <= 0
  ) {
    elements.calculatedUnitPrice.textContent = "0,00 €";
    return;
  }

  const coffeePriceCents =
    Math.round(packPriceCents / capsuleCount);

  elements.calculatedUnitPrice.textContent =
    formatMoney(coffeePriceCents);
}

async function savePrice() {
  const packPriceCents =
    parseEuroToCents(elements.packPriceInput.value);

  const capsuleCount =
    Number(elements.capsuleCountInput.value);

  if (
    packPriceCents === null ||
    packPriceCents <= 0
  ) {
    showToast(
      "Inserisci un prezzo valido.",
      true
    );
    return;
  }

  if (
    !Number.isInteger(capsuleCount) ||
    capsuleCount <= 0
  ) {
    showToast(
      "Inserisci un numero valido di capsule.",
      true
    );
    return;
  }

  if (!state.groupId) {
    return;
  }

  const coffeePriceCents =
    Math.round(packPriceCents / capsuleCount);

  setButtonLoading(
    elements.savePriceButton,
    true,
    "Salvataggio..."
  );

  try {
    const groupReference = doc(
      db,
      "groups",
      state.groupId
    );

    const historyReference = doc(
      collection(db, "groups", state.groupId, "history")
    );

    const batch = writeBatch(db);

    batch.update(groupReference, {
      packPriceCents,
      capsuleCount,
      coffeePriceCents,
      updatedAt: serverTimestamp()
    });

    batch.set(historyReference, {
      type: "price-updated",
      title: "Prezzo capsule aggiornato",
      detail:
        `${capsuleCount} capsule per ` +
        `${formatMoney(packPriceCents)}` +
        `, ${formatMoney(coffeePriceCents)} a caffè`,

      packPriceCents,
      capsuleCount,
      coffeePriceCents,
      createdAt: serverTimestamp(),
      createdBy: state.user.uid
    });

    await batch.commit();

    closeModal(elements.priceModal);
    showToast("Prezzo aggiornato.");
  } catch (error) {
    console.error(error);
    showToast(
      "Non è stato possibile salvare il prezzo.",
      true
    );
  } finally {
    setButtonLoading(
      elements.savePriceButton,
      false,
      "Salvataggio..."
    );
  }
}

/*
 * Acquisto capsule
 */

function askRegisterPurchase(person) {
  const packPriceCents =
    Number(state.group?.packPriceCents) || 0;

  if (packPriceCents <= 0) {
    showToast(
      "Configura prima il prezzo delle capsule.",
      true
    );

    openPriceModal();
    return;
  }

  state.selectedPerson = person;

  elements.purchaseMessage.textContent =
    `${person.name} ha comprato una confezione da ` +
    `${formatMoney(packPriceCents)}?`;

  openModal(elements.purchaseModal);
}

async function registerPurchase() {
  const person = state.selectedPerson;
  const packPriceCents =
    Number(state.group?.packPriceCents) || 0;

  if (
    !person ||
    !state.groupId ||
    packPriceCents <= 0
  ) {
    return;
  }

  setButtonLoading(
    elements.confirmPurchaseButton,
    true,
    "Registrazione..."
  );

  const personReference = doc(
    db,
    "groups",
    state.groupId,
    "people",
    person.id
  );

  const historyReference = doc(
    collection(db, "groups", state.groupId, "history")
  );

  try {
    await runTransaction(db, async transaction => {
      const personSnapshot =
        await transaction.get(personReference);

      if (!personSnapshot.exists()) {
        throw new Error("La persona non esiste più.");
      }

      const currentPerson = personSnapshot.data();

      transaction.update(personReference, {
        balanceCents: increment(-packPriceCents),
        updatedAt: serverTimestamp()
      });

      transaction.set(historyReference, {
        type: "capsules-purchased",
        title:
          `${currentPerson.name} ha comprato le capsule`,

        detail: `-${formatMoney(packPriceCents)}`,
        amountCents: -packPriceCents,
        personId: person.id,
        personName: currentPerson.name,
        createdAt: serverTimestamp(),
        createdBy: state.user.uid
      });
    });

    closeModal(elements.purchaseModal);
    state.selectedPerson = null;

    showToast("Acquisto registrato.");
  } catch (error) {
    console.error(error);
    showToast(
      error.message ||
      "Non è stato possibile registrare l'acquisto.",
      true
    );
  } finally {
    setButtonLoading(
      elements.confirmPurchaseButton,
      false,
      "Registrazione..."
    );
  }
}

/*
 * Invito
 */

async function copyInviteCode() {
  const inviteCode = state.group?.inviteCode;

  if (!inviteCode) {
    showToast(
      "Codice di invito non disponibile.",
      true
    );
    return;
  }

  try {
    await navigator.clipboard.writeText(inviteCode);
    showToast("Codice di invito copiato.");
  } catch (error) {
    console.error(error);

    window.prompt(
      "Copia questo codice di invito:",
      inviteCode
    );
  }
}

/*
 * Cronologia
 */

function getHistoryIcon(type) {
  switch (type) {
    case "coffee-added":
    case "coffee-removed":
      return "☕";

    case "capsules-purchased":
      return "▣";

    case "price-updated":
      return "€";

    case "person-added":
    case "person-removed":
    case "person-renamed":
    case "member-joined":
      return "♟";

    case "group-created":
      return "✓";

    default:
      return "•";
  }
}

function renderHistory() {
  elements.historyList.replaceChildren();

  elements.emptyHistory.classList.toggle(
    "hidden",
    state.history.length !== 0
  );

  elements.historyList.classList.toggle(
    "hidden",
    state.history.length === 0
  );

  for (const event of state.history) {
    const row = document.createElement("article");
    row.className = "history-row";

    const icon = document.createElement("div");
    icon.className = "history-icon";
    icon.textContent = getHistoryIcon(event.type);

    const content = document.createElement("div");

    const title = document.createElement("div");
    title.className = "history-title";
    title.textContent = event.title || "Attività";

    const detail = document.createElement("div");
    detail.className = "history-detail";
    detail.textContent = event.detail || "";

    content.append(title);

    if (event.detail) {
      content.append(detail);
    }

    const date = document.createElement("time");
    date.className = "history-date";
    date.textContent = formatDate(event.createdAt);

    row.append(icon, content, date);
    elements.historyList.append(row);
  }
}

/*
 * Eventi interfaccia
 */

elements.createGroupButton.addEventListener(
  "click",
  createGroup
);

elements.joinGroupButton.addEventListener(
  "click",
  joinGroup
);

elements.leaveGroupButton.addEventListener(
  "click",
  openLeaveGroupModal
);

elements.confirmLeaveGroupButton.addEventListener(
  "click",
  leaveGroup
);

elements.savePersonNameButton.addEventListener(
  "click",
  savePersonName
);

elements.openRemovePersonButton.addEventListener(
  "click",
  askRemoveSelectedPerson
);

elements.editPersonNameInput.addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      savePersonName();
    }
  }
);

elements.openAddPersonButton.addEventListener(
  "click",
  () => {
    elements.personNameInput.value = "";
    openModal(elements.addPersonModal);

    window.setTimeout(() => {
      elements.personNameInput.focus();
    }, 50);
  }
);

elements.addPersonButton.addEventListener(
  "click",
  addPerson
);

elements.personNameInput.addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      addPerson();
    }
  }
);

elements.priceButton.addEventListener(
  "click",
  openPriceModal
);

elements.savePriceButton.addEventListener(
  "click",
  savePrice
);

elements.packPriceInput.addEventListener(
  "input",
  updateCalculatedPrice
);

elements.capsuleCountInput.addEventListener(
  "input",
  updateCalculatedPrice
);

elements.confirmPurchaseButton.addEventListener(
  "click",
  registerPurchase
);

elements.confirmRemovePersonButton.addEventListener(
  "click",
  removePerson
);

elements.inviteButton.addEventListener(
  "click",
  copyInviteCode
);

elements.counterTabButton.addEventListener(
  "click",
  showCounterTab
);

elements.historyTabButton.addEventListener(
  "click",
  showHistoryTab
);

elements.groupNameInput.addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      createGroup();
    }
  }
);

elements.inviteCodeInput.addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      joinGroup();
    }
  }
);

document.querySelectorAll("[data-close-modal]")
  .forEach(element => {
    element.addEventListener("click", () => {
      const modalId =
        element.dataset.closeModal;

      const modal =
        document.getElementById(modalId);

      if (modal) {
        closeModal(modal);
      }
    });
  });

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") {
    return;
  }

  document.querySelectorAll(".modal:not(.hidden)")
    .forEach(modal => {
      closeModal(modal);
    });
});

function showStartupError(message) {
  elements.loadingScreen.innerHTML = `
    <div class="startup-error" role="alert">
      <div class="startup-error-icon" aria-hidden="true">☕</div>
      <h1>Configurazione necessaria</h1>
      <p>${message}</p>
      <code>firebase-config.js</code>
    </div>
  `;
}

/*
 * Autenticazione iniziale
 */

if (!firebaseConfigured) {
  showStartupError(
    "Inserisci le credenziali del tuo progetto Firebase per avviare il contatore."
  );
} else {
  onAuthStateChanged(auth, async user => {
    try {
      await setPersistence(auth, browserLocalPersistence);

      if (!user) {
        await signInAnonymously(auth);
        return;
      }

      state.user = user;

      elements.loadingScreen.classList.add("hidden");
      elements.app.classList.remove("hidden");

      const savedGroupId = getSavedGroup();

      if (savedGroupId) {
        const memberReference = doc(
          db,
          "groups",
          savedGroupId,
          "members",
          user.uid
        );

        try {
          const memberSnapshot =
            await getDoc(memberReference);

          if (memberSnapshot.exists()) {
            await openGroup(savedGroupId);
            return;
          }
        } catch (error) {
          console.error(error);
        }

        removeSavedGroup();
      }

      showHomeScreen();
    } catch (error) {
      console.error(error);

      elements.loadingScreen.innerHTML = `
        <p>
          Non è stato possibile avviare l'applicazione.
        </p>
      `;
    }
  });
}