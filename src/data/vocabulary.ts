import type { VocabCategory, VocabularyWord } from "../types";

export const vocabCategories: VocabCategory[] = [
  "Daily English", "Business", "Travel", "Education", "Food", "Technology", "Emotions", "Family", "Work",
];

type Row = [
  word: string, ipa: string, pos: VocabularyWord["partOfSpeech"], meaning: string,
  examples: string[], synonyms: string[], antonyms: string[], related: string[],
  level: VocabularyWord["level"], category: VocabCategory,
];

const rows: Row[] = [
  ["errand", "/ˈer.ənd/", "noun", "A short trip to do a small job, such as buying something or posting a letter.", ["I need to run a few errands before dinner.", "She sent her son on an errand to the pharmacy."], ["task", "chore"], [], ["chore", "to-do list", "run errands"], "Beginner", "Daily English"],
  ["commute", "/kəˈmjuːt/", "verb", "To travel regularly between your home and your place of work or study.", ["I commute to the office by metro.", "His daily commute takes an hour each way."], ["travel", "journey"], [], ["commuter", "rush hour", "local train"], "Beginner", "Daily English"],
  ["punctual", "/ˈpʌŋk.tʃu.əl/", "adjective", "Arriving or doing something at exactly the expected time.", ["Our teacher is always punctual.", "Please be punctual for the interview."], ["on time", "prompt"], ["late", "unpunctual"], ["punctuality", "deadline", "schedule"], "Intermediate", "Daily English"],
  ["negotiate", "/nəˈɡəʊ.ʃi.eɪt/", "verb", "To discuss something formally in order to reach an agreement.", ["We negotiated a better price with the supplier.", "The union is negotiating a new contract."], ["bargain", "discuss"], ["dictate"], ["negotiation", "deal", "compromise"], "Intermediate", "Business"],
  ["revenue", "/ˈrev.ən.juː/", "noun", "The total income a company receives from its business activities.", ["The company's revenue grew by 20% this year.", "Advertising is their main source of revenue."], ["income", "earnings"], ["expenditure"], ["profit", "turnover", "quarter"], "Advanced", "Business"],
  ["deadline", "/ˈded.laɪn/", "noun", "The latest time or date by which something must be finished.", ["The deadline for applications is 30 June.", "We worked late to meet the deadline."], ["due date", "time limit"], [], ["extension", "submit", "on time"], "Beginner", "Business"],
  ["itinerary", "/aɪˈtɪn.ər.ər.i/", "noun", "A detailed plan of a journey, including places and times.", ["Our itinerary includes two days in Udaipur.", "The travel agent emailed me the itinerary."], ["schedule", "route"], [], ["booking", "sightseeing", "trip"], "Intermediate", "Travel"],
  ["luggage", "/ˈlʌɡ.ɪdʒ/", "noun", "The bags and suitcases you carry when you travel.", ["Please do not leave your luggage unattended.", "How much luggage can I take on the flight?"], ["baggage", "bags"], [], ["suitcase", "check-in", "carry-on"], "Beginner", "Travel"],
  ["destination", "/ˌdes.tɪˈneɪ.ʃən/", "noun", "The place someone is travelling to.", ["Goa is a popular holiday destination.", "We reached our destination after six hours."], ["end point", "goal"], ["origin", "starting point"], ["journey", "arrive", "route"], "Beginner", "Travel"],
  ["curriculum", "/kəˈrɪk.jə.ləm/", "noun", "The subjects and content taught in a school, college or course.", ["Coding is now part of the school curriculum.", "The curriculum covers grammar and speaking."], ["syllabus", "programme"], [], ["subject", "module", "lesson plan"], "Intermediate", "Education"],
  ["revise", "/rɪˈvaɪz/", "verb", "To study again something you have already learned, especially before an exam.", ["I need to revise for my English test.", "She revises a little every evening."], ["review", "go over"], ["neglect"], ["revision", "exam", "notes"], "Beginner", "Education"],
  ["diligent", "/ˈdɪl.ɪ.dʒənt/", "adjective", "Showing care and steady effort in your work or studies.", ["Diligent students practise every day.", "He is a diligent and reliable employee."], ["hard-working", "careful"], ["lazy", "careless"], ["diligence", "effort", "dedication"], "Advanced", "Education"],
  ["delicious", "/dɪˈlɪʃ.əs/", "adjective", "Having a very pleasant taste or smell.", ["This biryani is delicious!", "The bakery sells delicious cakes."], ["tasty", "mouth-watering"], ["tasteless", "bland"], ["flavour", "recipe", "taste"], "Beginner", "Food"],
  ["ingredient", "/ɪnˈɡriː.di.ənt/", "noun", "One of the foods used to make a dish.", ["The main ingredients are rice, lentils and spices.", "Check the ingredients if you have an allergy."], ["component", "element"], [], ["recipe", "spice", "measure"], "Intermediate", "Food"],
  ["appetite", "/ˈæp.ɪ.taɪt/", "noun", "The feeling of wanting to eat.", ["Walking in the fresh air gave me an appetite.", "He has lost his appetite since he got sick."], ["hunger"], ["fullness"], ["appetiser", "craving", "hungry"], "Intermediate", "Food"],
  ["download", "/ˌdaʊnˈləʊd/", "verb", "To copy data or a file from the internet to your device.", ["Download the app to practise offline.", "The file is too large to download."], ["save", "transfer"], ["upload"], ["install", "file", "update"], "Beginner", "Technology"],
  ["device", "/dɪˈvaɪs/", "noun", "A machine or tool made for a particular purpose, such as a phone or tablet.", ["Please switch off all electronic devices.", "You can use English-Bridgeway on any device."], ["gadget", "appliance"], [], ["smartphone", "tablet", "charger"], "Beginner", "Technology"],
  ["innovative", "/ˈɪn.ə.veɪ.tɪv/", "adjective", "Using new methods or ideas.", ["The startup has an innovative approach to learning.", "We need innovative solutions to this problem."], ["creative", "original"], ["traditional", "conventional"], ["innovation", "invent", "technology"], "Advanced", "Technology"],
  ["grateful", "/ˈɡreɪt.fəl/", "adjective", "Feeling or showing thanks for something someone has done.", ["I'm grateful for your help.", "We are grateful to all our volunteers."], ["thankful", "appreciative"], ["ungrateful"], ["gratitude", "thank", "appreciate"], "Beginner", "Emotions"],
  ["anxious", "/ˈæŋk.ʃəs/", "adjective", "Worried and nervous about something that might happen.", ["She felt anxious before her interview.", "Don't be anxious; you're well prepared."], ["nervous", "worried"], ["calm", "relaxed"], ["anxiety", "stress", "tense"], "Intermediate", "Emotions"],
  ["overwhelmed", "/ˌəʊ.vəˈwelmd/", "adjective", "Feeling that you have too much to deal with.", ["I felt overwhelmed by the amount of work.", "She was overwhelmed with joy at the news."], ["swamped", "overcome"], ["unaffected"], ["overwhelming", "pressure", "burnout"], "Advanced", "Emotions"],
  ["sibling", "/ˈsɪb.lɪŋ/", "noun", "A brother or sister.", ["I have two siblings, a brother and a sister.", "Siblings often argue but stay close."], ["brother or sister"], [], ["twin", "cousin", "relative"], "Beginner", "Family"],
  ["in-laws", "/ˈɪn.lɔːz/", "noun", "The parents and relatives of your husband or wife.", ["We're visiting my in-laws this weekend.", "She gets along well with her in-laws."], ["relatives by marriage"], [], ["mother-in-law", "spouse", "wedding"], "Intermediate", "Family"],
  ["upbringing", "/ˈʌpˌbrɪŋ.ɪŋ/", "noun", "The way a child is cared for and taught while growing up.", ["He had a strict but loving upbringing.", "Our upbringing shapes our values."], ["childhood", "raising"], [], ["raise", "parenting", "values"], "Advanced", "Family"],
  ["colleague", "/ˈkɒl.iːɡ/", "noun", "A person you work with.", ["My colleague helped me with the presentation.", "I had lunch with a few colleagues."], ["co-worker", "teammate"], [], ["team", "manager", "office"], "Beginner", "Work"],
  ["promotion", "/prəˈməʊ.ʃən/", "noun", "A move to a higher position or rank at work.", ["She got a promotion after two years.", "Hard work led to his promotion."], ["advancement", "upgrade"], ["demotion"], ["appraisal", "raise", "career"], "Intermediate", "Work"],
  ["delegate", "/ˈdel.ɪ.ɡeɪt/", "verb", "To give part of your work or responsibility to someone else.", ["A good manager knows how to delegate.", "I delegated the report to my assistant."], ["assign", "entrust"], ["retain"], ["delegation", "responsibility", "team lead"], "Advanced", "Work"],
];

const slug = (w: string) => w.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const vocabularyWords: VocabularyWord[] = rows.map(
  ([word, pronunciation, partOfSpeech, meaning, examples, synonyms, antonyms, related, level, category]) => ({
    id: slug(word), word, pronunciation, partOfSpeech, meaning, examples, synonyms, antonyms, related, level, category,
  }),
);

export const getWord = (id: string) => vocabularyWords.find((w) => w.id === id);

/** Same word for everyone on a given day; rotates daily. */
export function getWordOfTheDay(date = new Date()): VocabularyWord {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const day = Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86_400_000);
  return vocabularyWords[day % vocabularyWords.length];
}
