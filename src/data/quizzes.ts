import type { Quiz, QuizCategory, QuizQuestion } from "../types";

export const quizCategories: QuizCategory[] = [
  { id: "grammar", title: "Grammar", description: "Mixed questions on nouns, pronouns, verbs and adjectives.", icon: "BookOpen" },
  { id: "vocabulary", title: "Vocabulary", description: "Meanings, synonyms and opposites of useful words.", icon: "Languages" },
  { id: "tenses", title: "Tenses", description: "Present, past and future forms in real sentences.", icon: "Clock" },
  { id: "articles", title: "Articles", description: "A, an, the or no article?", icon: "Type" },
  { id: "prepositions", title: "Prepositions", description: "In, on, at, for, since and more.", icon: "MapPin" },
  { id: "sentence-making", title: "Sentence Making", description: "Word order, questions, negatives and linking words.", icon: "AlignLeft" },
  { id: "spoken-english", title: "Spoken English", description: "Choose the most natural thing to say.", icon: "MessagesSquare" },
];

let n = 0;
const m = (prompt: string, options: string[], answer: string, explanation: string): QuizQuestion => ({
  id: `q${++n}`, type: "mcq", prompt, options, answer, explanation,
});
const f = (prompt: string, answer: string[], explanation: string): QuizQuestion => ({
  id: `q${++n}`, type: "fill", prompt, answer, explanation,
});

export const quizzes: Quiz[] = [
  {
    id: "grammar-essentials", categoryId: "grammar", title: "Grammar Essentials", level: "Beginner", minutes: 8,
    questions: [
      m("She ___ to school every day.", ["go", "goes", "going", "gone"], "goes", "Present simple with she adds -es: she goes."),
      f("I ___ a student.", ["am"], "With I, the verb be is am."),
      m("This bag is ___.", ["my", "me", "mine", "I"], "mine", "A possessive pronoun stands alone: mine."),
      m("Which word is an adjective?", ["quickly", "beautiful", "run", "happiness"], "beautiful", "Adjectives describe nouns: a beautiful garden."),
      f("The plural of “woman” is ___.", ["women"], "Irregular plural: woman → women."),
      m("He ___ swim very well.", ["can", "cans", "can to", "is can"], "can", "Modal verbs take no -s and no to."),
      m("Rahul and ___ went to the market.", ["me", "I", "myself", "mine"], "I", "Use the subject pronoun I in the subject position."),
      f("My house is ___ (big) than yours.", ["bigger"], "Short adjective + -er; double the final consonant: bigger."),
      m("Choose the correct sentence.", ["She don't like tea.", "She doesn't likes tea.", "She doesn't like tea.", "She not like tea."], "She doesn't like tea.", "Negative: does not + base verb."),
      m("How ___ information do you need?", ["many", "much", "few", "a"], "much", "Information is uncountable."),
    ],
  },
  {
    id: "everyday-words", categoryId: "vocabulary", title: "Everyday Words", level: "Beginner", minutes: 7,
    questions: [
      m("“Punctual” means…", ["very polite", "always on time", "very fast", "hard-working"], "always on time", "A punctual person arrives at the expected time."),
      m("The opposite of “delicious” is…", ["tasty", "bland", "sweet", "spicy"], "bland", "Bland means without much flavour."),
      f("A detailed plan for a trip is an ___.", ["itinerary"], "Itinerary: places and times for a journey."),
      m("Choose the synonym of “grateful”.", ["angry", "thankful", "tired", "proud"], "thankful", "Grateful and thankful mean the same."),
      f("A brother or sister is called a ___.", ["sibling"], "Sibling is a neutral word for brother or sister."),
      m("A person you work with is a…", ["neighbour", "colleague", "relative", "customer"], "colleague", "Colleague = co-worker."),
      m("The opposite of “download” is…", ["install", "upload", "delete", "save"], "upload", "Upload = send from your device to the internet."),
      f("I felt ___ (worried and nervous) before the exam.", ["anxious", "nervous"], "Anxious means worried and nervous."),
      m("To study again before an exam is to…", ["revise", "remove", "relax", "repeat"], "revise", "In British and Indian English, revise means study again."),
      m("Which word means “a move to a higher job”?", ["promotion", "deadline", "meeting", "salary"], "promotion", "Promotion = advancement at work."),
    ],
  },
  {
    id: "present-tenses", categoryId: "tenses", title: "Present Tenses", level: "Beginner", minutes: 8,
    questions: [
      m("Look! The children ___ in the garden.", ["play", "played", "are playing", "have played"], "are playing", "“Look!” shows the action is happening now."),
      f("My father ___ (read) the newspaper every morning.", ["reads"], "Habit with he/she: reads."),
      m("I ___ my homework already.", ["finish", "finished", "have finished", "am finishing"], "have finished", "Already goes with the present perfect."),
      m("Water ___ at 100°C.", ["boil", "boils", "is boiling", "boiled"], "boils", "General truth: present simple."),
      f("We ___ (live) here since 2015.", ["have lived", "have been living", "'ve lived"], "Since + point in time → present perfect."),
      m("___ she work on Saturdays?", ["Do", "Does", "Is", "Has"], "Does", "Question with she: Does + base verb."),
      m("I ___ understand this word.", ["am not", "don't", "doesn't", "not"], "don't", "Negative with I: do not."),
      f("Please be quiet. The baby ___ (sleep).", ["is sleeping", "'s sleeping"], "Happening now: present continuous."),
    ],
  },
  {
    id: "past-and-future", categoryId: "tenses", title: "Past and Future", level: "Intermediate", minutes: 8,
    questions: [
      f("Yesterday he ___ (buy) a new phone.", ["bought"], "Buy is irregular: bought."),
      m("We ___ a movie when the power went out.", ["watched", "were watching", "are watching", "watch"], "were watching", "Interrupted past action → past continuous."),
      m("By next June, I ___ here for five years.", ["will work", "will have worked", "work", "am working"], "will have worked", "By + future time → future perfect."),
      f("Don't worry, I ___ (call) you tomorrow.", ["will call", "'ll call"], "Promise about the future → will."),
      m("___ you go to the party last night?", ["Do", "Did", "Have", "Were"], "Did", "Past simple question: Did + base verb."),
      m("The train ___ before we reached the station.", ["left", "had left", "has left", "leaves"], "had left", "Earlier of two past actions → past perfect."),
      f("Look at those clouds. It ___ (rain).", ["is going to rain", "'s going to rain"], "Prediction from evidence → going to."),
      m("I ___ dinner at 8 p.m. yesterday.", ["was having", "am having", "have had", "will have"], "was having", "In progress at a past time → past continuous."),
    ],
  },
  {
    id: "articles-basics", categoryId: "articles", title: "A, An or The?", level: "Beginner", minutes: 6,
    questions: [
      m("I saw ___ elephant at the zoo.", ["a", "an", "the", "no article"], "an", "Vowel sound → an."),
      m("She is ___ honest person.", ["a", "an", "the", "no article"], "an", "The h is silent: an honest."),
      f("He wants to be ___ engineer.", ["an"], "Engineer starts with a vowel sound."),
      m("___ sun rises in the east.", ["A", "An", "The", "No article"], "The", "Unique things take the."),
      m("My brother studies at ___ university in Delhi.", ["a", "an", "the", "no article"], "a", "University begins with a “you” sound."),
      m("I love ___ music.", ["a", "an", "the", "no article"], "no article", "Music in general takes no article."),
      f("Can you close ___ door, please?", ["the"], "Both people know which door."),
      m("He has ___ MBA from Pune.", ["a", "an", "the", "no article"], "an", "MBA begins with the sound “em”."),
    ],
  },
  {
    id: "time-and-place", categoryId: "prepositions", title: "Time and Place", level: "Beginner", minutes: 6,
    questions: [
      m("The class starts ___ 9 o'clock.", ["in", "on", "at", "by"], "at", "Clock times take at."),
      m("My birthday is ___ 14 March.", ["in", "on", "at", "of"], "on", "Dates take on."),
      f("She was born ___ 1998.", ["in"], "Years take in."),
      m("The keys are ___ the table.", ["in", "on", "at", "over"], "on", "Surfaces take on."),
      m("I've known him ___ ten years.", ["since", "for", "from", "by"], "for", "A period of time takes for."),
      f("Wait for me ___ the bus stop.", ["at"], "A point or location takes at."),
      m("We usually go out ___ the weekend.", ["in", "on", "at", "by"], "at", "British/Indian English: at the weekend (US: on the weekend)."),
      m("He has worked here ___ 2020.", ["for", "since", "in", "from"], "since", "A starting point in time takes since."),
    ],
  },
  {
    id: "build-sentences", categoryId: "sentence-making", title: "Build Correct Sentences", level: "Beginner", minutes: 7,
    questions: [
      m("Choose the correct word order.", ["Coffee I drink every morning.", "I drink coffee every morning.", "I every morning drink coffee.", "Drink I coffee every morning."], "I drink coffee every morning.", "Subject + Verb + Object + Time."),
      m("Make it a question: “She lives in Chennai.”", ["She lives in Chennai?", "Does she live in Chennai?", "Does she lives in Chennai?", "Lives she in Chennai?"], "Does she live in Chennai?", "Does + subject + base verb."),
      f("Make it negative: “They play cricket.” → They ___ play cricket.", ["don't", "do not"], "do not / don't + base verb."),
      m("Which question is correct?", ["Where you are going?", "Where are you going?", "Where you going are?", "Where going you are?"], "Where are you going?", "Wh- word + helping verb + subject + main verb."),
      f("I was tired, ___ I went to bed early.", ["so"], "So shows a result."),
      m("I wanted to go out, ___ it was raining.", ["because", "so", "but", "and"], "but", "But shows contrast."),
      m("Choose the best sentence.", ["Because I was late. I took a taxi.", "I took a taxi because I was late.", "I took a taxi. Because late.", "Because late I took taxi."], "I took a taxi because I was late.", "A because-clause must join a main clause."),
    ],
  },
  {
    id: "natural-replies", categoryId: "spoken-english", title: "Natural Replies", level: "Beginner", minutes: 6,
    questions: [
      m("Someone asks “How are you?” The most natural reply is…", ["I am fine, and you?", "Yes, I am.", "I am good at English.", "Thank you, bye."], "I am fine, and you?", "Answer briefly and return the question."),
      m("On the phone, how do you politely ask who is calling?", ["Who are you?", "May I know who's calling, please?", "Tell your name.", "What is your good name?"], "May I know who's calling, please?", "Polite and natural."),
      f("In a shop: “How much ___ this shirt?”", ["is"], "Singular: How much is…?"),
      m("Which is the best way to introduce yourself?", ["Myself Rahul.", "I'm Rahul. Nice to meet you.", "Me Rahul.", "Rahul is my name, I am."], "I'm Rahul. Nice to meet you.", "“Myself Rahul” is a common mistake."),
      m("You didn't hear what someone said. You say…", ["What?", "Sorry, could you say that again?", "Repeat.", "Again tell."], "Sorry, could you say that again?", "Polite way to ask for repetition."),
      m("Someone says “Thank you so much!” You reply…", ["Okay.", "You're welcome.", "Yes.", "Same to you."], "You're welcome.", "Standard reply to thanks."),
      f("“Would you mind opening the window?” “Not at ___.”", ["all"], "“Not at all” means you're happy to help."),
      m("To ask for a lower price politely, you might say…", ["Give less.", "Is there any discount?", "Price is wrong.", "Make it cheap."], "Is there any discount?", "Polite and common in shops."),
    ],
  },
];

export const getQuizCategory = (id: string) => quizCategories.find((c) => c.id === id);
export const getQuizzesForCategory = (categoryId: string) => quizzes.filter((q) => q.categoryId === categoryId);
export const getQuiz = (categoryId: string, quizId: string) =>
  quizzes.find((q) => q.categoryId === categoryId && q.id === quizId);
