import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Platform, AppState, DeviceEventEmitter, useWindowDimensions } from 'react-native';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';

const verses = [
  {
    "en": "\"God is love.\" (1 John 4:8)",
    "ar": "\"الله محبة.\" (رسالة يوحنا الأولى 4: 8)"
  },
  {
    "en": "\"I can do all things through Christ who strengthens me.\" (Philippians 4:13)",
    "ar": "\"أستطيع كل شيء في المسيح الذي يقويني.\" (فيلبي 4: 13)"
  },
  {
    "en": "\"The Lord is my shepherd; I shall not want.\" (Psalm 23:1)",
    "ar": "\"الرب راعي فلا يعوزني شيء.\" (مزمور 23: 1)"
  },
  {
    "en": "\"Your word is a lamp to my feet and a light to my path.\" (Psalm 119:105)",
    "ar": "\"سراج لرجلي كلامك ونور لسبيلي.\" (مزمور 119: 105)"
  },
  {
    "en": "\"For we walk by faith, not by sight.\" (2 Corinthians 5:7)",
    "ar": "\"لأننا بالإيمان نسلك لا بالعيان.\" (كورنثوس الثانية 5: 7)"
  },
  {
    "en": "\"Rejoice in the Lord always; again I will say, rejoice.\" (Philippians 4:4)",
    "ar": "\"افرحوا في الرب كل حين، وأقول أيضا: افرحوا.\" (فيلبي 4: 4)"
  },
  {
    "en": "\"Let all that you do be done in love.\" (1 Corinthians 16:14)",
    "ar": "\"لتصر كل أموركم في محبة.\" (كورنثوس الأولى 16: 14)"
  },
  {
    "en": "\"In the beginning, God created the heavens and the earth.\" (Genesis 1:1)",
    "ar": "\"في البدء خلق الله السماوات والأرض.\" (التكوين 1: 1)"
  },
  {
    "en": "\"For all have sinned and fall short of the glory of God.\" (Romans 3:23)",
    "ar": "\"إذ الجميع أخطأوا وأعوزهم مجد الله.\" (رومية 3: 23)"
  },
  {
    "en": "\"The wages of sin is death, but the free gift of God is eternal life in Christ Jesus our Lord.\" (Romans 6:23)",
    "ar": "\"لأن أجرة الخطية هي موت، وأما هبة الله فهي حياة أبدية بالمسيح يسوع ربنا.\" (رومية 6: 23)"
  },
  {
    "en": "\"Trust in the Lord with all your heart, and do not lean on your own understanding.\" (Proverbs 3:5)",
    "ar": "\"توكل على الرب بكل قلبك، وعلى فهمك لا تعتمد.\" (أمثال 3: 5)"
  },
  {
    "en": "\"I am the way, and the truth, and the life. No one comes to the Father except through me.\" (John 14:6)",
    "ar": "\"أنا هو الطريق والحق والحياة. ليس أحد يأتي إلى الآب إلا بي.\" (يوحنا 14: 6)"
  },
  {
    "en": "\"Be strong and courageous. Do not be frightened, and do not be dismayed, for the Lord your God is with you wherever you go.\" (Joshua 1:9)",
    "ar": "\"تشدد وتشجع! لا ترهب ولا ترتعب لأن الرب إلهك معك حيثما تذهب.\" (يشوع 1: 9)"
  },
  {
    "en": "\"Come to me, all who labor and are heavy laden, and I will give you rest.\" (Matthew 11:28)",
    "ar": "\"تعالوا إلي يا جميع المتعبين والثقيلي الأحمال، وأنا أريحكم.\" (متى 11: 28)"
  },
  {
    "en": "\"But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness.\" (Galatians 5:22)",
    "ar": "\"وأما ثمر الروح فهو: محبة، فرح، سلام، طول أناة، لطف، صلاح، إيمان.\" (غلاطية 5: 22)"
  },
  {
    "en": "\"And we know that for those who love God all things work together for good.\" (Romans 8:28)",
    "ar": "\"ونحن نعلم أن كل الأشياء تعمل معا للخير للذين يحبون الله.\" (رومية 8: 28)"
  },
  {
    "en": "\"Therefore, if anyone is in Christ, he is a new creation. The old has passed away; behold, the new has come.\" (2 Corinthians 5:17)",
    "ar": "\"إذا إن كان أحد في المسيح فهو خليقة جديدة: الأشياء العتيقة قد مضت، هوذا الكل قد صار جديدا.\" (كورنثوس الثانية 5: 17)"
  },
  {
    "en": "\"Cast all your anxiety on him because he cares for you.\" (1 Peter 5:7)",
    "ar": "\"ملقين كل همكم عليه، لأنه هو يعتني بكم.\" (بطرس الأولى 5: 7)"
  },
  {
    "en": "\"But seek first the kingdom of God and his righteousness, and all these things will be added to you.\" (Matthew 6:33)",
    "ar": "\"لكن اطلبوا أولا ملكوت الله وبره، وهذه كلها تزاد لكم.\" (متى 6: 33)"
  },
  {
    "en": "\"For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.\" (Jeremiah 29:11)",
    "ar": "\"لأني عرفت الأفكار التي أنا مفتكر بها عنكم، يقول الرب، أفكار سلام لا شر، لأعطيكم آخرة ورجاء.\" (إرميا 29: 11)"
  },
  {
    "en": "\"The Lord is my light and my salvation; whom shall I fear?\" (Psalm 27:1)",
    "ar": "\"الرب نوري وخلاصي، ممن أخاف؟\" (مزمور 27: 1)"
  },
  {
    "en": "\"Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God.\" (Philippians 4:6)",
    "ar": "\"لا تهتموا بشيء، بل في كل شيء بالصلاة والدعاء مع الشكر، لتعلم طلباتكم لدى الله.\" (فيلبي 4: 6)"
  },
  {
    "en": "\"And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus.\" (Philippians 4:7)",
    "ar": "\"وسلام الله الذي يفوق كل عقل، يحفظ قلوبكم وأفكاركم في المسيح يسوع.\" (فيلبي 4: 7)"
  },
  {
    "en": "\"Jesus Christ is the same yesterday and today and forever.\" (Hebrews 13:8)",
    "ar": "\"يسوع المسيح هو هو أمسا واليوم وإلى الأبد.\" (عبرانيين 13: 8)"
  },
  {
    "en": "\"I am the Alpha and the Omega, the first and the last, the beginning and the end.\" (Revelation 22:13)",
    "ar": "\"أنا الألف والياء، البداية والنهاية، الأول والآخر.\" (رؤيا يوحنا 22: 13)"
  },
  {
    "en": "\"Be still, and know that I am God.\" (Psalm 46:10)",
    "ar": "\"كفوا واعلموا أني أنا الله.\" (مزمور 46: 10)"
  },
  {
    "en": "\"Love is patient and kind; love does not envy or boast; it is not arrogant or rude.\" (1 Corinthians 13:4-5)",
    "ar": "\"المحبة تتأنى وترفق. المحبة لا تحسد. المحبة لا تتفاخر، ولا تنتفخ.\" (كورنثوس الأولى 13: 4)"
  },
  {
    "en": "\"So now faith, hope, and love abide, these three; but the greatest of these is love.\" (1 Corinthians 13:13)",
    "ar": "\"أما الآن فيثبت: الإيمان والرجاء والمحبة، هذه الثلاثة ولكن أعظمهن المحبة.\" (كورنثوس الأولى 13: 13)"
  },
  {
    "en": "\"God is our refuge and strength, a very present help in trouble.\" (Psalm 46:1)",
    "ar": "\"الله لنا ملجأ وقوة. عونا في الضيقات وجد شديدا.\" (مزمور 46: 1)"
  },
  {
    "en": "\"Create in me a clean heart, O God, and renew a right spirit within me.\" (Psalm 51:10)",
    "ar": "\"قلبا نقيا اخلق في يا الله، وروحا مستقيما جدد في داخلي.\" (مزمور 51: 10)"
  },
  {
    "en": "\"The fear of the Lord is the beginning of wisdom.\" (Proverbs 9:10)",
    "ar": "\"بدء الحكمة مخافة الرب.\" (أمثال 9: 10)"
  },
  {
    "en": "\"For by grace you have been saved through faith. And this is not your own doing; it is the gift of God.\" (Ephesians 2:8)",
    "ar": "\"لأنكم بالنعمة مخلصون، بالإيمان، وذلك ليس منكم. هو عطية الله.\" (أفسس 2: 8)"
  },
  {
    "en": "\"We love because he first loved us.\" (1 John 4:19)",
    "ar": "\"نحن نحبه لأنه هو أحبنا أولا.\" (رسالة يوحنا الأولى 4: 19)"
  },
  {
    "en": "\"I am the good shepherd. The good shepherd lays down his life for the sheep.\" (John 10:11)",
    "ar": "\"أنا هو الراعي الصالح، والراعي الصالح يبذل نفسه عن الخراف.\" (يوحنا 10: 11)"
  },
  {
    "en": "\"Thy word have I hid in mine heart, that I might not sin against thee.\" (Psalm 119:11)",
    "ar": "\"خبأت كلامك في قلبي لكيلا أخطئ إليك.\" (مزمور 119: 11)"
  },
  {
    "en": "\"But those who hope in the LORD will renew their strength. They will soar on wings like eagles.\" (Isaiah 40:31)",
    "ar": "\"وأما منتظرو الرب فيجددون قوة. يرفعون أجنحة كالنسور.\" (إشعياء 40: 31)"
  },
  {
    "en": "\"The joy of the LORD is your strength.\" (Nehemiah 8:10)",
    "ar": "\"لأن فرح الرب هو قوتكم.\" (نحميا 8: 10)"
  },
  {
    "en": "\"Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.\" (Matthew 5:16)",
    "ar": "\"فليضئ نوركم هكذا قدام الناس، لكي يروا أعمالكم الحسنة، ويمجدوا أباكم الذي في السماوات.\" (متى 5: 16)"
  },
  {
    "en": "\"I have told you these things, so that in me you may have peace. In this world you will have trouble. But take heart! I have overcome the world.\" (John 16:33)",
    "ar": "\"قد كلمتكم بهذا ليكون لكم في سلام. في العالم سيكون لكم ضيق، ولكن ثقوا: أنا قد غلبت العالم.\" (يوحنا 16: 33)"
  },
  {
    "en": "\"Therefore do not worry about tomorrow, for tomorrow will worry about itself. Each day has enough trouble of its own.\" (Matthew 6:34)",
    "ar": "\"فلا تهتموا للغد، لأن الغد يهتم بما لنفسه. يكفي اليوم شره.\" (متى 6: 34)"
  },
  {
    "en": "\"Blessed are the peacemakers, for they will be called children of God.\" (Matthew 5:9)",
    "ar": "\"طوبى لصانعي السلام، لأنهم أبناء الله يدعون.\" (متى 5: 9)"
  },
  {
    "en": "\"A friend loves at all times, and a brother is born for a time of adversity.\" (Proverbs 17:17)",
    "ar": "\"الصديق يحب في كل وقت، أما الأخ فللشدة يولد.\" (أمثال 17: 17)"
  },
  {
    "en": "\"He heals the brokenhearted and binds up their wounds.\" (Psalm 147:3)",
    "ar": "\"يشفي المنكسري القلوب، ويجبر كسرهم.\" (مزمور 147: 3)"
  },
  {
    "en": "\"But God shows his love for us in that while we were still sinners, Christ died for us.\" (Romans 5:8)",
    "ar": "\"ولكن الله بين محبته لنا، لأنه ونحن بعد خطاة مات المسيح لأجلنا.\" (رومية 5: 8)"
  },
  {
    "en": "\"Set your minds on things that are above, not on things that are on earth.\" (Colossians 3:2)",
    "ar": "\"اهتموا بما فوق لا بما على الأرض،\" (كولوسي 3: 2)"
  },
  {
    "en": "\"Whatever you do, work heartily, as for the Lord and not for men.\" (Colossians 3:23)",
    "ar": "\"وكل ما فعلتم فافعلوا من القلب، كما للرب ليس للناس،\" (كولوسي 3: 23)"
  },
  {
    "en": "\"For we are his workmanship, created in Christ Jesus for good works.\" (Ephesians 2:10)",
    "ar": "\"لأننا نحن عمله، مخلوقين في المسيح يسوع لأعمال صالحة،\" (أفسس 2: 10)"
  },
  {
    "en": "\"The steadfast love of the Lord never ceases; his mercies never come to an end.\" (Lamentations 3:22)",
    "ar": "\"إنه من إحسانات الرب أننا لم نفن، لأن مراحمه لا تزول.\" (مراثي إرميا 3: 22)"
  },
  {
    "en": "\"They are new every morning; great is your faithfulness.\" (Lamentations 3:23)",
    "ar": "\"هي جديدة في كل صباح. كثيرة أمانتك.\" (مراثي إرميا 3: 23)"
  },
  {
    "en": "\"Submit yourselves therefore to God. Resist the devil, and he will flee from you.\" (James 4:7)",
    "ar": "\"فاخضعوا لله. قاوموا إبليس فيهرب منكم.\" (يعقوب 4: 7)"
  },
  {
    "en": "\"Draw near to God, and he will draw near to you.\" (James 4:8)",
    "ar": "\"اقتربوا إلى الله فيقترب إليكم.\" (يعقوب 4: 8)"
  },
  {
    "en": "\"And let us not grow weary of doing good, for in due season we will reap, if we do not give up.\" (Galatians 6:9)",
    "ar": "\"فلا نفشل في عمل الخير لأننا سنحصد في وقته إن كنا لا نكل.\" (غلاطية 6: 9)"
  },
  {
    "en": "\"I am the light of the world. Whoever follows me will not walk in darkness, but will have the light of life.\" (John 8:12)",
    "ar": "\"أنا هو نور العالم. من يتبعني فلا يمشي في الظلمة بل يكون له نور الحياة.\" (يوحنا 8: 12)"
  },
  {
    "en": "\"My grace is sufficient for you, for my power is made perfect in weakness.\" (2 Corinthians 12:9)",
    "ar": "\"تكفيك نعمتي، لأن قوتي في الضعف تكمل.\" (كورنثوس الثانية 12: 9)"
  },
  {
    "en": "\"Peace I leave with you; my peace I give to you. Not as the world gives do I give to you.\" (John 14:27)",
    "ar": "\"سلاما أترك لكم. سلامي أعطيكم. ليس كما يعطي العالم أعطيكم أنا.\" (يوحنا 14: 27)"
  },
  {
    "en": "\"For where two or three are gathered in my name, there am I among them.\" (Matthew 18:20)",
    "ar": "\"لأنه حيثما اجتمع اثنان أو ثلاثة باسمي فهناك أكون في وسطهم.\" (متى 18: 20)"
  },
  {
    "en": "\"Ask, and it will be given to you; seek, and you will find; knock, and it will be opened to you.\" (Matthew 7:7)",
    "ar": "\"اسألوا تعطوا. اطلبوا تجدوا. اقرعوا يفتح لكم.\" (متى 7: 7)"
  },
  {
    "en": "\"The heavens declare the glory of God, and the sky above proclaims his handiwork.\" (Psalm 19:1)",
    "ar": "\"السماوات تحدث بمجد الله، والفلك يخبر بعمل يديه.\" (مزمور 19: 1)"
  }
];

export default function FooterVerses() {
  const { locale } = useLanguage();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const [verse, setVerse] = useState(verses[0]);

  useEffect(() => {
    const randomize = () => {
      const randomIndex = Math.floor(Math.random() * verses.length);
      setVerse(verses[randomIndex]);
    };

    // Pick a random verse initially on mount
    randomize();

    // Randomize whenever the app comes to the foreground
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        randomize();
      }
    });

    // Randomize specifically when a login event is emitted
    const loginSub = DeviceEventEmitter.addListener('onUserLogin', randomize);

    return () => {
      appStateSub.remove();
      loginSub.remove();
    };
  }, []);

  const getFontSize = () => {
    if (width < 400) return 12; // Mobile phones
    if (width < 768) return 14; // Tablets / small windows
    return 16; // PC / Desktop
  };

  const getPadding = () => {
    if (width < 400) return 8;
    if (width < 768) return 12;
    return 16;
  };

  const isRtl = locale === 'ar';
  const text = isRtl ? verse.ar : verse.en;

  return (
    <View style={[styles.container, { 
      backgroundColor: theme.headerBackground || 'rgba(255, 255, 255, 0.8)',
      borderTopColor: theme.borderColor || '#ddd',
      padding: getPadding(),
    }]}>
      <Text style={[styles.verseText, { 
        color: theme.text || '#333',
        fontSize: getFontSize() 
      }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 3 },
      android: { elevation: 3 },
      web: { boxShadow: '0 -2px 4px rgba(0,0,0,0.05)' }
    }),
  },
  verseText: {
    fontStyle: 'italic',
    textAlign: 'center',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  }
});
