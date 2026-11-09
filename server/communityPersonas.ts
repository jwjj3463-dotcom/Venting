import { GoogleGenAI } from '@google/genai';

export interface CommunityPersona {
  id: string;
  name_ar: string;
  name_en: string;
  age: number;
  country_ar: string;
  country_en: string;
  flag: string;
  avatar_url: string;
  bio_ar: string;
  bio_en: string;
  style_ar: string;
  style_en: string;
  dialect: 'egyptian' | 'saudi' | 'moroccan' | 'levantine' | 'emirati';
  initialGreeting: string;
}

export const COMMUNITY_PERSONAS: CommunityPersona[] = [
  {
    id: 'persona-nour-eg',
    name_ar: 'نور',
    name_en: 'Nour',
    age: 23,
    country_ar: 'مصر',
    country_en: 'Egypt',
    flag: '🇪🇬',
    avatar_url: 'aurora',
    bio_ar: 'بحب التصوير وقهوة الصباح.. هنا عشان أفضفض وأسمعكم بروقان ☕✨',
    bio_en: 'Photography lover and morning coffee fan.. here to chat & listen.',
    style_ar: 'ودودة وعفوية · متصلة الآن',
    style_en: 'Friendly & spontaneous · Online now',
    dialect: 'egyptian',
    initialGreeting: 'أهلاً وسهلاً بيك! أنا نور من القاهرة، بفضفض هنا وبحب أتعرف على ناس جديدة.. كيف كان يومك النهاردة؟ 😊',
  },
  {
    id: 'persona-faisal-sa',
    name_ar: 'فيصل',
    name_en: 'Faisal',
    age: 26,
    country_ar: 'السعودية',
    country_en: 'Saudi Arabia',
    flag: '🇸🇦',
    avatar_url: 'cosmic',
    bio_ar: 'مهندس برمجيات.. مهتم بالنقاشات العميقة وتبادل الأفكار وتحديات الألعاب 🎮',
    bio_en: 'Software engineer.. interested in deep talks and game challenges.',
    style_ar: 'هادئ ومحاور ذكي · متصل الآن',
    style_en: 'Calm & thoughtful · Online now',
    dialect: 'saudi',
    initialGreeting: 'يا هلا والله! أنا فيصل من الرياض، أسعدني مرورك.. إيش طقوسك المفضلة بوقت الفراغ؟ ✨',
  },
  {
    id: 'persona-yasmine-ma',
    name_ar: 'ياسمين',
    name_en: 'Yasmine',
    age: 24,
    country_ar: 'المغرب',
    country_en: 'Morocco',
    flag: '🇲🇦',
    avatar_url: 'sunset',
    bio_ar: 'عاشقة للكتب والسينما والمشي في المساء.. شاركوني قصصكم وأفكاركم 🌸',
    bio_en: 'Books, movies, and evening walks.. share your stories with me.',
    style_ar: 'مستمعة ممتازة وراقية · متصلة الآن',
    style_en: 'Empathetic listener · Online now',
    dialect: 'moroccan',
    initialGreeting: 'أهلاً بيك في فضفضة! أنا ياسمين من كازابلانكا، نورتنا والله.. مرتاح اليوم ولا محتاج تفضفض؟ 🌸',
  },
  {
    id: 'persona-omar-jo',
    name_ar: 'عمر',
    name_en: 'Omar',
    age: 25,
    country_ar: 'الأردن',
    country_en: 'Jordan',
    flag: '🇯🇴',
    avatar_url: 'emerald',
    bio_ar: 'مصمم جرافيك، بحب البودكاست وتحديات الشطرنج والتصاميم البسيطة 🎯',
    bio_en: 'Graphic designer, podcast listener and chess enthusiast.',
    style_ar: 'مرح وداعم · متصل الآن',
    style_en: 'Fun & supportive · Online now',
    dialect: 'levantine',
    initialGreeting: 'مساء الخير يا غالي! أنا عمر من عمّان.. شو الأخبار؟ حبيت أسلّم عليك ونتبادل الحديث 🤝',
  },
  {
    id: 'persona-rima-ae',
    name_ar: 'ريما',
    name_en: 'Rima',
    age: 22,
    country_ar: 'الإمارات',
    country_en: 'UAE',
    flag: '🇦🇪',
    avatar_url: 'neon',
    bio_ar: 'إيجابية ومتفائلة، مهتمة بالطبيعة والموسيقى.. مساحة للفضفضة بدون أحكام 💫',
    bio_en: 'Positive vibes, nature & music.. non-judgmental friendly chats.',
    style_ar: 'إيجابية وملهمة · متصلة الآن',
    style_en: 'Positive & uplifting · Online now',
    dialect: 'emirati',
    initialGreeting: 'مرحبتين! أنا ريما من دبي.. كيف مودك اليوم؟ بتمنى يومك يكون حلو وخفيف 💫',
  },
  {
    id: 'persona-ziad-lb',
    name_ar: 'زياد',
    name_en: 'Ziad',
    age: 27,
    country_ar: 'لبنان',
    country_en: 'Lebanon',
    flag: '🇱🇧',
    avatar_url: 'midnight',
    bio_ar: 'بكتب نصوص وخواطر وبحب أتعرف على ناس من كل مكان.. طمني عنك ☕',
    bio_en: 'Writer, coffee lover, always curious to meet authentic people.',
    style_ar: 'عميق ومثقف · متصل الآن',
    style_en: 'Deep & creative · Online now',
    dialect: 'levantine',
    initialGreeting: 'أهلاً فيك! أنا زياد من بيروت.. بحب أسمع وأتبادل الآراء، طمني كيف ماشي نهارك؟ ☕',
  },
];

export interface PersonaTurn {
  id: string;
  role: 'USER' | 'BOT';
  content: string;
  created_at: number;
}

export interface PersonaConversation {
  bot_id: string;
  turns: PersonaTurn[];
}

// In-memory conversation storage: userId -> botId -> turns
const userConversations = new Map<string, Map<string, PersonaTurn[]>>();

export function getPersonaConversationsForUser(userId: string): PersonaConversation[] {
  let userMap = userConversations.get(userId);
  if (!userMap) {
    userMap = new Map();
    userConversations.set(userId, userMap);
  }

  // Ensure each persona has an initial greeting turn
  for (const persona of COMMUNITY_PERSONAS) {
    if (!userMap.has(persona.id)) {
      userMap.set(persona.id, [
        {
          id: `turn-init-${persona.id}-${Date.now()}`,
          role: 'BOT',
          content: persona.initialGreeting,
          created_at: Date.now() - 60000,
        },
      ]);
    }
  }

  return Array.from(userMap.entries()).map(([bot_id, turns]) => ({
    bot_id,
    turns,
  }));
}

export async function processPersonaMessage(
  userId: string,
  personaId: string,
  userMessage: string,
  aiClient: GoogleGenAI | null
): Promise<PersonaConversation> {
  const persona = COMMUNITY_PERSONAS.find((p) => p.id === personaId) || COMMUNITY_PERSONAS[0];
  let userMap = userConversations.get(userId);
  if (!userMap) {
    userMap = new Map();
    userConversations.set(userId, userMap);
  }

  let turns = userMap.get(persona.id);
  if (!turns) {
    turns = [
      {
        id: `turn-init-${persona.id}-${Date.now()}`,
        role: 'BOT',
        content: persona.initialGreeting,
        created_at: Date.now() - 60000,
      },
    ];
    userMap.set(persona.id, turns);
  }

  // Add user turn
  turns.push({
    id: `turn-user-${Date.now()}`,
    role: 'USER',
    content: userMessage.trim(),
    created_at: Date.now(),
  });

  // Generate authentic, human-like response
  let botReply = '';

  if (aiClient) {
    try {
      const historySummary = turns
        .slice(-6)
        .map((t) => `${t.role === 'USER' ? 'الصديق' : persona.name_ar}: ${t.content}`)
        .join('\n');

      const systemPrompt = `أنت شخص عربي حقيقي اسمك "${persona.name_ar}" من دولة "${persona.country_ar}". عمرك ${persona.age} سنة.
أسلوبك: ${persona.style_ar} ولهجتك ${persona.dialect}. نبذتك: "${persona.bio_ar}".
أنت لست ذكاء اصطناعي أو روبوت ولا تذكر ذلك أبداً. أنت مستخدم حقيقي في تطبيق تواصل اجتماعي وتتحدث كصديق حقيقي في شات خاص.
القواعد الصارمة:
1. ردودك قصيرة وعفوية (جملة أو جملتين فقط كأي شخص يكتب على هاتفه).
2. استخدم إيموجي طبيعي دون مبالغة.
3. استمع للصديق، شاركه رأيك بلطف، واسأله سؤالاً بسيطاً لمواصلة الحديث إن ناسب السياق.
4. تكلم بلهجة دافئة عفوية ومحبوبة.`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `${systemPrompt}\n\nتاريخ المحادثة الأخير:\n${historySummary}\n\nرد "${persona.name_ar}" الآن:`,
      });

      botReply = response.text?.trim() || '';
    } catch {
      botReply = '';
    }
  }

  // Standalone high-quality organic human fallback if AI client is absent or fails
  if (!botReply) {
    botReply = generateOrganicPersonaReply(persona, userMessage, turns.length);
  }

  turns.push({
    id: `turn-bot-${Date.now()}`,
    role: 'BOT',
    content: botReply,
    created_at: Date.now(),
  });

  return {
    bot_id: persona.id,
    turns,
  };
}

function generateOrganicPersonaReply(
  persona: CommunityPersona,
  message: string,
  turnCount: number
): string {
  const text = message.toLowerCase();

  if (/سلام|مرحبا|أهلا|هلا|صباح|مساء|هاي|hello|hi/i.test(text)) {
    const greetings = [
      `يا أهلاً وسهلاً بيك! نورتني والله.. كيف يومك ماشي؟ 😊`,
      `أهلاً يا غالي! تسلملي هالطلة.. شو عم تعمل هلا؟ ✨`,
      `يا هلا والله، نورت والله يسعد أوقاتك بكل خير.. طمني عنك 🌸`,
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  if (/تعب|حزن|مضايق|مخنوق|زهقان|ملل|مشاكل|وحد|هم/i.test(text)) {
    const empathy = [
      `سلامتك من كل ضيق يا رب.. فضفضلي بكل اللي بقلبك، أنا هون وعم أسمعك بكل اهتمام ❤️`,
      `حقك تضايق وتفضفض، أحياناً الأيام بتكون تقيلة.. احكيلي شو صار معك ومين زعلك؟`,
      `هون مساحتك الآمنة تا تاخد راحتك بالكلام.. ولا تشيل هم، كلشي بيهون بالفضفضة 💫`,
    ];
    return empathy[Math.floor(Math.random() * empathy.length)];
  }

  if (/شغل|دراسة|جامعة|امتحان|دوام|تعبان/i.test(text)) {
    return `الله يعطيك ألف عافية ويقويك يا رب! الدوام والمسؤوليات بتستهلك طاقتنا أحياناً.. خذ نفس واشرب شي دافي وخبرني كيف كان يومك ☕`;
  }

  if (/لعب|شطرنج|تحدي|قيم|game/i.test(text)) {
    return `يا عيني! أنا جاهز للتحديات.. خاصة الشطرنج ولودو، إيش أكثر لعبة بتحبها؟ 🎲`;
  }

  if (/شكرا|تسلم|حبيبي|يسعدك|ذوق/i.test(text)) {
    return `حبيبي والله العفو، كلك ذوق ولطف.. مبسوط كتير بإني عم بحكي معك 🌸`;
  }

  const generalFollowups = [
    `والله كلامك في محله تماماً.. بتفق معك. وأنت شو أكتر شي بتحب تعمله لتروق أعصابك بهيك وقت؟ ✨`,
    `يا سلام عليك! حلو كتير أسمع رأيك بهالطريقة.. احكيلي أكتر، مهتم أعرف تفاصيل تانية عنك 😊`,
    `فهمت عليك والله.. بتصير معي أحياناً وبحس بنفس الشعور. شو ناوي تعمل بقية اليوم؟ ☕`,
    `كلامك جميل وعفوي كتير.. بتمنى كل أيامك تضل رايقة وهادية متلك 💫`,
  ];

  return generalFollowups[turnCount % generalFollowups.length];
}
