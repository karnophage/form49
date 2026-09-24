// data.js — all the words and tuning numbers live here.
// Code structure: MIT. All text content in this file (names, deeds, dialogue, memos, rules):
// (c) 2026 karnophage, all rights reserved. See LICENSE.
// Want more jokes, deeds or souls? Edit this file. The rules live in game.js.

window.F49 = (() => {
  // Deed categories. Each bad deed belongs to one, and each one routes to a court.
  // The real Ten Courts tradition varies by text; this routing table is simplified for the game.
  const CATS = {
    fraud:     { court: 2, label: "FRAUD" },
    shirk:     { court: 3, label: "SHIRKING" },
    tax:       { court: 4, label: "TAX" },
    violence:  { court: 5, label: "VIOLENCE" },
    irrev:     { court: 6, label: "IRREVERENCE" },
    gossip:    { court: 7, label: "GOSSIP" },
    filial:    { court: 8, label: "UNFILIAL" },
    arson:     { court: 9, label: "ARSON" },
  };

  // What each category means, for tooltips.
  const CAT_INFO = {
    fraud:    "Cheating people for gain: swindles, fake remedies, rigged games, lying matchmakers.",
    shirk:    "Dodging duty or gratitude: stealing credit, sneering at gifts, escaping debts.",
    tax:      "Cheating the state or customers on money and measures: evasion, clipped coins, crooked scales.",
    violence: "Hurting people: biting, brawling, pushing rivals into wells.",
    irrev:    "Disrespecting Heaven and sacred things: cursing the sky, misusing temple property, chronic weather complaints.",
    gossip:   "Harming people with words: rumours, slander, spreading other people's business.",
    filial:   "Failing your parents and ancestors: forgetting them, robbing them, never writing home.",
    arson:    "Setting fire to things that aren't yours, and other mischief on a grand scale.",
  };

  // Notes on the kings from the actual tradition. Kings without a solid, well-known fact get none.
  const KING_NOTES = {
    1:  "Judges the newly dead first. In many accounts the Mirror of Retribution stands in his court, showing each soul its own misdeeds.",
    5:  "The best-known of the Ten Kings, adapted from the Indian god Yama. Folk tradition says he once ran the First Court but was moved to the Fifth for being too soft on souls who had died unjustly.",
    7:  "Named after Mount Tai, which Chinese belief linked to the dead long before Buddhism arrived.",
    9:  "His name, Pingdeng, means \"impartial\" or \"equal\".",
    10: "The Wheel-Turning King. He decides what each soul is reborn as, then sends it on to Meng Po.",
  };

  // Real-world terms that appear in the papers. `re` is matched against the text.
  const GLOSSARY = [
    { re: "Qingming", title: "Qingming", text: "Tomb-Sweeping Day, a spring festival when families clean their ancestors' graves and leave offerings." },
    { re: "Diamond Sutra", title: "Diamond Sutra", text: "A short Buddhist scripture. Copying sutras by hand was a classic way to earn merit. A copy printed in 868 CE is the oldest dated printed book known." },
    { re: "Released 200 fish", title: "Life release", text: "Fangsheng: buying captive animals and setting them free to earn merit. Critics point out that many are caught just so they can be sold for release." },
    { re: "tiger bone", title: "Tiger bone tonic", text: "A traditional remedy. Tigers are protected now, and China banned the tiger bone trade in 1993. In any case, this one was pork." },
    { re: "mahjong", title: "Mahjong", text: "A tile game for four. It only dates to the 1800s. The underworld has decided not to care." },
    { re: "temple incense", title: "Temple incense", text: "Incense sticks burned as offerings at temples. Not for pipes." },
    { re: "imperial exam|exam cramming|failed exam", title: "Imperial exams", text: "The civil-service exams that chose China's officials for about 1,300 years, until 1905. Famously brutal. Some candidates sat them for decades." },
    { re: "Meng Po", title: "Meng Po", text: "The goddess who serves the Soup of Forgetfulness at the bridge out of the underworld, so souls forget their past life before rebirth." },
    { re: "the Book", title: "The Book of Life and Death", text: "The underworld's register of every person's allotted lifespan and deeds. Clerical errors in it are a classic plot in Chinese ghost stories." },
    { re: "Ox-Head|Horse-Face", title: "Ox-Head and Horse-Face", text: "Niutou and Mamian, the underworld's guards. They collect the souls of the dead and escort them to judgement." },
    { re: "hell money|Hell Bank Notes", title: "Hell bank notes", text: "Joss paper printed to look like banknotes and burned as offerings, so the dead have money to spend. The denominations are enormous. The afterlife has an inflation problem." },
    { re: "Censorate", title: "The Censorate", text: "The imperial agency whose job was to watch officials and report corruption." },
    { re: "Filial Piety", title: "Filial piety", text: "Xiao: respect and care for your parents and ancestors, one of the core Confucian virtues." },
    { re: "Fengdu", title: "Fengdu", text: "A real town on the Yangtze known as the Ghost City, full of temples and shrines to the rulers of the underworld." },
    { re: "White Horse Temple", title: "White Horse Temple", text: "Traditionally said to be China's first Buddhist temple, founded in Luoyang in 68 CE." },
    { re: "Hanshan Temple", title: "Hanshan Temple", text: "A temple in Suzhou, famous for its bell and a Tang poem about hearing it ring at midnight." },
    { re: "Shaolin Temple", title: "Shaolin Temple", text: "The Buddhist temple famous for kung fu. This certificate appears to come from the gift shop." },
    { re: "Matchmaker", title: "Matchmaker", text: "Marriages were traditionally arranged through a matchmaker who negotiated between the families. Accuracy about the groom was optional." },
    { re: "Night-soil collector", title: "Night-soil collector", text: "Collected human waste from homes to sell to farmers as fertilizer. Honest work, if you don't mind the smell." },
    { re: "Chang'an", title: "Chang'an", text: "Capital of the Tang dynasty and one of the largest cities in the world at the time. Modern Xi'an." },
  ];

  // The Ten Kings, in the usual order.
  const COURTS = {
    1:  { king: "King Qinguang",  dept: "Intake (that's you)" },
    2:  { king: "King Chujiang",  dept: "Fraud & Quackery",            sentence: "Reimburse every customer. In person. One at a time." },
    3:  { king: "King Songdi",    dept: "Shirking & Ingratitude",      sentence: "Finish every task you ever left half-done." },
    4:  { king: "King Wuguan",    dept: "Tax Evasion & Short Weights", sentence: "Be weighed, forever, on your own crooked scales." },
    5:  { king: "King Yama",      dept: "Violence & Brawling",         sentence: "Yama will see you personally. He is in a mood." },
    6:  { king: "King Biancheng", dept: "Cursing Heaven",              sentence: "Stand in the rain you complained about." },
    7:  { king: "King Taishan",   dept: "Gossip & Slander",            sentence: "Hear every rumour you started, read aloud, forever." },
    8:  { king: "King Dushi",     dept: "Unfilial Conduct",            sentence: "Attend every birthday you missed. All at once." },
    9:  { king: "King Pingdeng",  dept: "Arson & Grand Mischief",      sentence: "Sweep up the ashes. All of them." },
    10: { king: "King Zhuanlun",  dept: "Rebirth & Allocations" },
  };

  // Every given name has a lookalike, for clerical errors.
  const LOOKALIKE = {
    Ming: "Ping", Ping: "Ming", Mei: "Wei", Wei: "Mei", Hua: "Hui", Hui: "Hua",
    Jun: "Jin", Jin: "Jun", Lan: "Lin", Lin: "Lan", Yun: "Yan", Yan: "Yun",
    Bao: "Hao", Hao: "Bao", Tao: "Tai", Tai: "Tao", Fang: "Feng", Feng: "Fang",
  };
  const GIVEN = Object.keys(LOOKALIKE);
  const SURNAMES = ["Wang", "Li", "Zhang", "Liu", "Chen", "Yang", "Huang", "Zhao", "Wu", "Zhou",
    "Xu", "Sun", "Ma", "Zhu", "Hu", "Guo", "He", "Lin", "Luo", "Gao"];

  const HOMETOWNS = ["Luoyang", "Kaifeng", "Suzhou", "Hangzhou", "Chang'an", "Yangzhou",
    "A village near Chengdu", "Fengdu (commutes)", "Somewhere damp (illegible)", "Nanjing"];

  const OCCUPATIONS = ["Noodle seller", "Tea merchant", "Fortune teller", "Rice farmer",
    "Night-soil collector", "Scholar (failed exam 9 times)", "Matchmaker", "Pig farmer",
    "Tax collector", "Monk (mostly)", "Opera singer", "Blacksmith", "Magistrate's clerk",
    "Herbalist", "Dumpling folder", "Retired bandit"];

  const CAUSES = ["Old age, finally", "Kicked by a donkey", "Ate the wrong mushroom",
    "Exam cramming (4th night awake)", "Struck by lightning (see Court 6?)", "Laughed too hard at an opera",
    "Fell down a well", "Lost an argument with a water buffalo", "Choked on a mooncake",
    "Dispute with a tiger", "Chill caught at a very long funeral", "Mahjong-related excitement"];

  const GOOD_DEEDS = [
    ["Fed stray cats for 11 years", 3],
    ["Returned a lost purse, contents intact", 2],
    ["Returned a lost purse, minus a finder's fee", 1],
    ["Donated to the temple roof fund", 2],
    ["Let an ox cart go first at a narrow bridge", 1],
    ["Copied the Diamond Sutra by hand, three times", 3],
    ["Released 200 fish (bought them first)", 1],
    ["Paid taxes on time, cheerfully", 2],
    ["Swept the ancestors' graves every Qingming", 3],
    ["Taught village children to read", 4],
    ["Built a bridge over a flood-prone river", 5],
    ["Nursed a sick neighbour for a whole winter", 4],
    ["Shared umbrella with a stranger", 1],
    ["Never once cheated at mahjong", 2],
  ];

  const BAD_DEEDS = {
    fraud: [
      ["Sold 'tiger bone' tonic (it was pork)", -3],
      ["Rigged the village mahjong table", -2],
      ["As matchmaker, lied about groom's height by a full hand", -2],
    ],
    shirk: [
      ["Took credit for an apprentice's work", -3],
      ["Complained about a free banquet", -1],
      ["Escaped debtors' prison via the latrine", -3],
    ],
    tax: [
      ["Declared the family ox as 'decorative'", -2],
      ["Shaved the edges off coins", -3],
      ["Used a hollow-bottomed rice measure", -3],
    ],
    violence: [
      ["Bit a tax collector", -3],
      ["Started a tavern brawl over dumpling folding", -2],
      ["Pushed a rival into a well (he was fine, just damp)", -4],
    ],
    irrev: [
      ["Shouted at the sky during a drought", -2],
      ["Complained about the weather 4,112 times", -2],
      ["Lit a pipe with temple incense", -3],
    ],
    gossip: [
      ["Spread a rumour that the magistrate wears a wig", -2],
      ["Told the whole market about a neighbour's rash", -2],
      ["Invented a scandal and sold it to a storyteller", -3],
    ],
    filial: [
      ["Forgot father's birthday six years running", -3],
      ["Pawned mother's hairpins for gambling money", -4],
      ["Moved to the capital, never wrote home", -2],
    ],
    arson: [
      ["Burned down a rival's noodle stall", -5],
      ["Set fire to the granary 'by accident'", -5],
      ["Set off fireworks indoors", -3],
    ],
  };

  const GREETINGS = [
    "Is there a queue for the queue?",
    "I was told there would be tea.",
    "I'd like to speak to whoever is in charge of dying.",
    "My family burned a paper mansion for me. Where do I collect it?",
    "I've been standing in this line for 49 days.",
    "Is this the line for reincarnation or complaints?",
    "My fortune teller said I'd live to a hundred.",
    "Before you start: I was mostly good. Mostly.",
    "Do I take a number?",
    "I think I left the stove on.",
    "I'd like it noted that I was very polite to the ox.",
    "Horse-Face stepped on my foot.",
  ];

  // Things souls claim. None of it is in the Book, so none of it counts.
  const CLAIMS = [
    "I once saved an entire village from a flood. It's probably not written down.",
    "Write down that I was kind to my mother-in-law. She won't have mentioned it.",
    "I prayed every single day. Well. Most festivals.",
    "Put me down for rebirth as a scholar, please. Something with a view.",
  ];

  const BRIBE_LINES = [
    "Perhaps this might speed things along?",
    "My grandson burned these for me. I'm told they're legal tender.",
    "For your trouble. And your forgetfulness.",
    "A small token of my ongoing respect for Form 49.",
  ];

  const REACT = {
    rebirth: [
      [["soul", "Will I have thumbs this time?"], ["ox", "Depends on the 10th Court's budget."]],
      [["soul", "Can I choose what I come back as?"], ["ox", "No."]],
      [["soul", "Tell my family to stop burning so much paper."]],
      [["soul", "Is Meng Po's soup vegetarian?"], ["ox", "You won't remember either way."]],
    ],
    hell: [
      [["soul", "I'd like to appeal."], ["ox", "Appeals go through the First Court. Current wait: 400 years."]],
      [["soul", "Which way is that court?"], ["ox", "Down."]],
      [["soul", "I want to file a complaint."], ["ox", "Form 12-B. It's also in hell."]],
      [["soul", "This is a clerical error!"], ["ox", "We have a separate stamp for those. You didn't get it."]],
    ],
    return: [
      [["soul", "So... I'm not dead?"], ["ox", "Not yet. Go home. Sorry about the funeral."]],
      [["soul", "Who's paying for my coffin, then?"], ["ox", "Keep it. You'll need it eventually."]],
      [["soul", "My wife already remarried!"], ["ox", "Not our department."]],
    ],
  };

  // What a positive net merit buys you at the 10th Court.
  const TIERS = [
    [1, "a mosquito. A healthy one."],
    [3, "a carp in a temple pond (fed daily, never promoted)"],
    [6, "a well-loved cat in a noodle shop"],
    [10, "a merchant's third son"],
    [15, "a scholar who passes the imperial exam first try"],
    [22, "a Grade-8 clerk in the First Court. A promotion!"],
  ];

  // This month's valid temple seal. Forgeries get one detail wrong.
  const SEAL = { shape: "square", ink: "vermilion", code: "LOTUS-7" };
  const SEAL_FAKES = { shape: ["round"], ink: ["indigo"], code: ["LOTUS-1", "L0TUS-7", "LOTUS-T"] };
  const TEMPLES = ["White Horse Temple", "Hanshan Temple", "Jade Buddha Temple", "Shaolin Temple (gift shop)"];

  // You. A dead clerk working off your own karmic debt.
  const PLAYER_LIFE = [
    { t: "Took sick leave to watch a cricket fight", v: -2, cat: "fraud" },
    { t: "Complained about the weather, daily, for 40 years", v: -2, cat: "irrev" },
    { t: "Still owes the noodle seller 40 coppers", v: -2, cat: "shirk" },
    { t: "Held a door open for a monk (once)", v: 1 },
  ];

  const ECON = { wage: 1, dorm: 3, sutra: 5, sutraMerit: 1, bribeMerit: -2, auditChance: 0.25, abacus: 2 };

  // Hand-written souls, slotted in at fixed queue positions each day.
  // deeds: [text, value, category (bad deeds only)]
  const SPECIALS = {
    liu: {
      name: "Liu Mei", age: 88, lifespan: 88, occupation: "Grandmother (professional)",
      hometown: "Suzhou", cause: "Old age, finally", collector: "Ox-Head",
      deeds: [["Fed stray cats for 11 years", 3], ["Carried a grandson up 400 temple steps", 4],
        ["Cheated at mahjong (family games only)", -1, "fraud"]],
      lines: [["ox", "First one's easy, rookie. Add up the Book. Above zero means Rebirth. Stamp it."],
        ["soul", "Is this where I collect my pension?"]],
      look: { old: true, hair: "bun" },
    },
    zhangwei: {
      name: "Zhang Wei", age: 34, lifespan: 79, occupation: "Tea merchant",
      hometown: "Hangzhou", cause: "Collected while napping", collector: "Horse-Face",
      deeds: [["Paid taxes on time, cheerfully", 2], ["Complained about a free banquet", -1, "shirk"]],
      lines: [["soul", "I was having a nap. Then a horse picked me up."],
        ["ox", "There are about 300,000 Zhang Weis. Horse-Face grabbed the nearest one. Check the Book."]],
    },
    qian: {
      name: "Qian Duoduo", age: 61, lifespan: 61, occupation: "Grain merchant",
      hometown: "Yangzhou", cause: "Mahjong-related excitement", collector: "Ox-Head",
      deeds: [["Used a hollow-bottomed rice measure", -3, "tax"], ["Declared the family ox as 'decorative'", -2, "tax"],
        ["Donated to the temple roof fund (plaque with own name, 2 metres tall)", 1]],
      lines: [["soul", "Clerk! Friend! Let's not make this complicated."]],
      bribe: 8,
      look: { hair: "cap", beard: true },
    },
    son: {
      name: "Gao Jun", age: 45, lifespan: 45, occupation: "Scholar (passed, eventually)",
      hometown: "Chang'an", cause: "Exam cramming (4th night awake)", collector: "Ox-Head",
      deeds: [["Taught village children to read", 3], ["Moved to the capital, never wrote home", -2, "filial"]],
      lines: [["soul", "I was going to write. I was very busy being a scholar."],
        ["ox", "It's Filial Piety Week. Read your memo."]],
      look: { hair: "cap" },
    },
    teller: {
      name: "Hu Lan", age: 61, lifespan: 63, occupation: "Fortune teller",
      hometown: "Kaifeng", cause: "Fell down a well", collector: "Horse-Face",
      deeds: [["Told customers what they wanted to hear", -1, "fraud"], ["Shared umbrella with a stranger", 1]],
      lines: [["soul", "I predicted I'd die at 63. I'm 61. Somebody here can't count."]],
      look: { hair: "long" },
    },
    forger: {
      name: "Zhou Bao", age: 52, lifespan: 52, occupation: "Herbalist",
      hometown: "Nanjing", cause: "Ate the wrong mushroom", collector: "Ox-Head",
      deeds: [["Sold 'tiger bone' tonic (it was pork)", -3, "fraud"], ["Nursed a sick neighbour for a whole winter", 4],
        ["Lit a pipe with temple incense", -3, "irrev"]],
      cert: { temple: "Hanshan Temple", value: 4, shape: "round", ink: "vermilion", code: "LOTUS-7" },
      lines: [["soul", "I have a certificate. Very official. Very round."]],
    },
    cousin: {
      name: "Yan Tao", age: 70, lifespan: 70, occupation: "Retired bandit",
      hometown: "Luoyang", cause: "Old age, finally", collector: "Ox-Head",
      deeds: [["Bit a tax collector", -3, "violence"], ["Built a bridge over a flood-prone river", 5],
        ["Spread a rumour that the magistrate wears a wig", -2, "gossip"]],
      cert: { temple: "White Horse Temple", value: 3, shape: "square", ink: "vermilion", code: "LOTUS-7" },
      lines: [["soul", "I'm related to King Yama. On my mother's side. Distantly. Very distantly."],
        ["ox", "Everyone's related to Yama. Do the sums."]],
      bribe: 5,
      look: { old: true, beard: true, hair: "topknot" },
    },
  };

  const BASE_RULES = [
    "The name on the Case File must match the Book <b>exactly</b>. If not: <b>RETURN</b>.",
    "Age at death must equal the allotted lifespan. If not, someone collected them early: <b>RETURN</b>.",
    "Add up every deed in the Book. Ignore anything the soul tells you. They're dead, they have nothing to lose.",
    "Net merit above zero: <b>REBIRTH</b>. Zero doesn't count. Breaking even is not a virtue.",
    "Zero or below: <b>HELL</b>. Route to the court of their single worst deed. A tie goes to the higher court. They have more budget.",
  ];

  const DAYS = [
    {
      title: "Day 1: Orientation",
      memo: [
        "Welcome to the First Court, Clerk. You are Grade 9, Third Class, probationary.",
        "You are here to work off your own karmic debt. Every soul you file correctly is +1 on your own ledger. Every mistake is -1.",
        "Read the Rulebook. Then read it again. I was demoted from this court for being lenient. I will not be demoted again because of you.",
      ],
      extraRules: [],
      filialDouble: false, certs: false,
      specials: { 0: "liu", 2: "zhangwei", 4: "qian" },
    },
    {
      title: "Day 2: Filial Piety Week",
      memo: [
        "The Ministry of Rites has declared Filial Piety Awareness Week.",
        "Effective immediately, all UNFILIAL deeds count <b>double</b>. Yes, including the ones already in the Book. No, I did not write this rule.",
      ],
      extraRules: ["<span class=\"new\">NEW</span> Filial Piety Week: <b>UNFILIAL</b> deeds count <b>double</b>."],
      filialDouble: true, certs: false,
      specials: { 1: "son", 3: "teller" },
    },
    {
      title: "Day 3: Certificates",
      memo: [
        "Temples above have started selling Merit Certificates. Some are real. Many are not.",
        "A real certificate adds its value to net merit. Check the seal against this month's seal: shape, ink and code must all match. Forged ones count for nothing.",
        "Also, the Censorate is auditing this week. I mention this for no reason.",
      ],
      extraRules: [
        "Filial Piety Week continues: <b>UNFILIAL</b> deeds count <b>double</b>.",
        "<span class=\"new\">NEW</span> Merit Certificates: add the value <b>only</b> if the seal matches this month's seal exactly. Forged? Ignore it.",
      ],
      filialDouble: true, certs: true,
      specials: { 1: "forger", 3: "cousin" },
    },
  ];

  return { CAT_INFO, KING_NOTES, GLOSSARY, CATS, COURTS, LOOKALIKE, GIVEN, SURNAMES, HOMETOWNS, OCCUPATIONS, CAUSES, GOOD_DEEDS, BAD_DEEDS,
    GREETINGS, CLAIMS, BRIBE_LINES, REACT, TIERS, SEAL, SEAL_FAKES, TEMPLES, PLAYER_LIFE, ECON, SPECIALS,
    BASE_RULES, DAYS };
})();
