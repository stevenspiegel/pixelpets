// Hand-designed 24×24 pixel-art sprites keyed by the species emoji they
// replace. Any emoji that doesn't have an entry here falls back to the
// emoji renderer in Pet.tsx and PetSwitcher.tsx.
//
// Character key reference (full table in ./palette.ts):
//   .  transparent      k  outline black     w  white      g  gray
//   b  brown            B  dark brown        t  tan        T  dark tan
//   o  orange           O  dark orange       y  yellow     Y  gold
//   r  red              p  pink              P  purple     Q  dark purple
//   l  green            L  dark green        c  cyan       C  blue
//   N  navy             s  skin              H  dark skin  E  hot pink

export type Sprite = readonly string[];

// 🐉 dragon — side profile, head + coiling body, red tongue
const DRAGON: Sprite = [
  '........................',
  '........................',
  '..........LLLLLL........',
  '.........LllllllL.......',
  '........LlllllllLL......',
  '........LkllllllLL......',
  '........LllllllllL......',
  '........LlllllllllL.....',
  '........LllrrllllllL....',
  '........LLllllllllLL....',
  '.........LllllllllL.....',
  '..........LllllllL......',
  '..........LllllllL......',
  '.........LllllllL.......',
  '........LlllllllL.......',
  '........LlllllllL.......',
  '.......LllllllllL.......',
  '.......LllllllllL.......',
  '......LllllllllL........',
  '......LllllllL..........',
  '......LLlllLL...........',
  '.......LLLLL............',
  '........................',
  '........................',
];

// 🦄 unicorn — head + body silhouette, gold horn, pink mane, side profile
const UNICORN: Sprite = [
  '........................',
  '..........Y.............',
  '.........YY.............',
  '........YY..............',
  '.......YY...............',
  '......YY.......EE.......',
  '.....GwwG.....EEEE......',
  '....GwwwwG...EEEEEE.....',
  '....GwkwwG..EEwwwwEE....',
  '....GwwwwG.EwwwwwwwwE...',
  '....GwwwwwGwwwwwwwwwwE..',
  '.....Gwwwwwwwwwwwwwwww..',
  '......GwwwwwwwwwwwwwwG..',
  '......GwwwwwwwwwwwwwG...',
  '......GwwwwwwwwwwwwG....',
  '......GwwwwwwwwwwwwG....',
  '......GwwwwwwwwwwwwG....',
  '......Gw.GGw.GGw.GG.....',
  '......Gw..Gw..Gw..G.....',
  '......Gw..Gw..Gw..G.....',
  '......Gw..Gw..Gw..G.....',
  '......GG..GG..GG..G.....',
  '........................',
  '........................',
];

// 🧜 mermaid — torso (skin) + green tail, pink hair
const MERMAID: Sprite = [
  '........................',
  '........................',
  '..........EEEE..........',
  '.........EEEEEE.........',
  '........EEsssEEE........',
  '.......EEssssssEE.......',
  '......EEsksksssEE.......',  // eyes
  '......Esssrrssssp.......',  // mouth
  '......EsssssssssE.......',
  '.......sssssssss........',
  '........EEsssEE.........',
  '.........EsE............',
  '........EssssE..........',
  '.......EssssssE.........',
  '......LlllllllL.........',
  '......LllllllllL........',
  '.....LllllllllllL.......',
  '....LlllllLLllllL.......',
  '...LllllLL..LLllL.......',
  '..LllllL......LllL......',
  '.LllllL........LlllL....',
  'LlllllL.........LlllL...',
  '.LLLLL...........LLL....',
  '........................',
];

// 🦖 t-rex — green dino with tiny arms and big tail
const TREX: Sprite = [
  '........................',
  '........................',
  '...............LLLLL....',
  '.............LLlllllL...',
  '............LllklllllL..',  // eye
  '............LllllllllL..',
  '............LllllllllL..',
  '............Lwwwwwwwwl..',  // teeth row
  '...........LLLLLlllL....',
  '...........LllllllL.....',
  '..........LllllllL......',
  '.........LlllllllL......',
  '........LllllllllL......',
  '.LL....LlllllllllL......',
  'LllLLLLLlllllllllL......',
  '.LLLLLLllllllllllLL.....',
  '......LLLllllllllllL....',
  '........LllllllllllL....',
  '........Lll.LlllllL.....',
  '........Ll..Lll.LL......',
  '.......LLL..LLL.........',
  '........................',
  '........................',
  '........................',
];

// 🦕 sauropod — long-necked dinosaur, green, side view
const SAUROPOD: Sprite = [
  '........................',
  '........................',
  '..............LLLL......',
  '.............LllllL.....',
  '.............LkllllL....',  // eye
  '.............LlllllL....',
  '..............Llllll....',
  '..............LlllL.....',
  '..............LlllL.....',
  '..............LlllL.....',
  '..............LlllL.....',
  '..............LlllL.....',
  '...........LLLLlllL.....',
  '..........LllllllllLL...',
  '.........LllllllllllllL.',
  '........LllllllllllllllL',
  '........LllllllllllllllL',
  '........LllllllllllllllL',
  '........LLLlllllllLLLLL.',
  '..........Ll.LllllL.....',
  '..........Ll..LllL......',
  '.........LLL..LLL.......',
  '........................',
  '........................',
];

// 🐙 octopus — purple, big head, dangling tentacles
const OCTOPUS: Sprite = [
  '........................',
  '........................',
  '.........QQQQQQ.........',
  '........QPPPPPPQ........',
  '.......QPPPPPPPPQ.......',
  '......QPPPPPPPPPPQ......',
  '......QPkPPPPPPkPQ......',  // eyes
  '......QPPPPPPPPPPQ......',
  '......QPPPpppPPPPQ......',  // mouth
  '......QPPPPPPPPPPQ......',
  '.......QPPPPPPPPQ.......',
  '......QPPPPPPPPPPQ......',
  '.....QPPPPPPPPPPPPQ.....',
  '....QPPPPPPPPPPPPPPQ....',
  '...QPPQPPQPPQPPQPPQPQ...',
  '..QPQ.QPQ.QPQ.QPQ.QPQ...',
  '.QPQ...QQ...QQ...QQ.Q...',
  '.QQ.....Q....Q....Q.....',
  '........Q....Q....Q.....',
  '.......QQ....Q....QQ....',
  '......QQ....QQ.....Q....',
  '........................',
  '........................',
  '........................',
];

// 🐈 cat — orange tabby sitting facing viewer
const CAT: Sprite = [
  '........................',
  '........................',
  '......oO........Oo......',  // ears tops
  '.....oOOo......oOOo.....',
  '....oOoOOo....oOOoOo....',  // ear inners
  '...oOOoOoOoooOoOoOOo....',
  '..oOOOoOoOOOOOoOoOOOo...',
  '..oOoOoOoOoOoOoOoOoOo...',
  '..oOoOoOoOoOoOoOoOoOo...',
  '..ookOoOoOoOoOoOokOOo...',  // eyes
  '..oOoOoOoOoOoOoOoOoOo...',
  '..oOoOoOop.po.poOoOoO...',  // nose+mouth area
  '..oOoOoOoOOpOOoOoOoOo...',
  '..oOoOoOoOoOoOoOoOoOo...',
  '...oOoOoOoOoOoOoOoOo....',
  '....oOoOoOoOoOoOoOo.....',
  '.....oOoOoOoOoOoOo......',
  '......oOoOoOoOoOo.......',
  '.......oOoOoOoOo........',
  '........oOoOoOo.........',
  '.........oOoOo..........',
  '..........ooo...........',
  '........................',
  '........................',
];

// 🐕 dog — brown puppy facing viewer with floppy ears
const DOG: Sprite = [
  '........................',
  '........................',
  '....BB............BB....',
  '...BbbB..........BbbB...',
  '..BbbbbB........BbbbbB..',  // ears
  '..BbbbbbBBBBBBBBbbbbbB..',
  '..BbbbbbbbbbbbbbbbbbbB..',
  '..BbbbbbbbbbbbbbbbbbbB..',
  '..BbbkbbbbbbbbbbbkbbbB..',  // eyes
  '..BbbbbbbbbbbbbbbbbbbB..',
  '..BbbbbbbbbbkkbbbbbbbB..',  // nose
  '..BbbbbbbbbkkkkbbbbbbB..',
  '..BbbbbbbBBBBBBBBbbbbB..',
  '...BbbbbBwwwwwwwwBbbbB..',  // mouth/teeth
  '...BbbbbBBwwwwwwBBbbB...',
  '....BbbbbBBBBBBBBbbB....',
  '.....BbbbbbbbbbbbbB.....',
  '......BbbbbbbbbbbB......',
  '.......BbbbbbbbbB.......',
  '........BbbbbbbB........',
  '.........BBBBBB.........',
  '........................',
  '........................',
  '........................',
];

// === COMMON ===

// 🐇 rabbit — white with pink ears
const RABBIT: Sprite = [
  '........................',
  '........................',
  '........ww....ww........',
  '.......wpw....wpw.......',
  '.......wpw....wpw.......',
  '.......wpw....wpw.......',
  '.......www....www.......',
  '........ww....ww........',
  '........wwwwwwww........',
  '.......wwwwwwwwww.......',
  '.......wkwwwwwwkw.......',
  '.......wwwwwwwwww.......',
  '........wwwprwwww.......',
  '........wwwwwwww........',
  '......wwwwwwwwwwww......',
  '.....wwwwwwwwwwwwww.....',
  '.....wwwwwwwwwwwwww.....',
  '.....wwwwwwwwwwwwww.....',
  '......wwwwwwwwwwww......',
  '.......www....www.......',
  '.......ww......ww.......',
  '........................',
  '........................',
  '........................',
];

// 🐁 mouse — gray with big round ears, pink tail
const MOUSE: Sprite = [
  '........................',
  '........................',
  '........................',
  '......gg........gg......',
  '.....gGgg......ggGg.....',
  '.....gpgg......ggpg.....',
  '.....gGgg......ggGg.....',
  '......gg.gggggg.gg......',
  '.........ggggggg........',
  '........ggggggggg.......',
  '........gkgggggkg.......',
  '........gggggggggg......',
  '........ggggprgggg......',
  '.........ggggggggg......',
  '..........gggggggg......',
  '...........gggggggp.....',
  '............gggggppp....',
  '.............ggggpppp...',
  '..............ggppp.....',
  '..............ggp.......',
  '..............gg........',
  '........................',
  '........................',
  '........................',
];

// 🐀 rat — darker gray, longer body, long tail
const RAT: Sprite = [
  '........................',
  '........................',
  '......GGG........GGG....',
  '.....GgGGg......gGGGg...',
  '.....GpGGg......gGGpG...',
  '.....GGGGg......gGGGG...',
  '......GGG.GGGGGG.GGG....',
  '.........GGGGGGGG.......',
  '........GGGGGGGGGG......',
  '........GkGGGGGGkG......',
  '........GGGGGGGGGG......',
  '.......GGGGGGrGGGGG.....',
  '........GGGGGGGGGG......',
  '........GGGGGGGGGGG.....',
  '.........GGGGGGGGGGG....',
  '..........GGGGGGGGGGG...',
  '...........GGGGGGGGGGG..',
  '............GGGGGGGGGGGp',
  '..............GGGGGGGpp.',
  '...............GGGGppp..',
  '................GGpp....',
  '................gp......',
  '........................',
  '........................',
];

// 🐦 bird — blue songbird with yellow beak
const BIRD: Sprite = [
  '........................',
  '........................',
  '........................',
  '............CcccC.......',
  '...........CccccccC.....',
  '..........CcccccccCc....',
  '.........Ccccccccccc....',
  '........Ccckccccccccc...',
  '.......Cccccccccccccc...',
  '.......Ccccccccccccccy..',
  '.......Cccccccccccyyy...',
  '.......Cccccccccccc.....',
  '.......CccccccccccccC...',
  '........Cccccccccccc....',
  '.........CccccccccccCC..',
  '.........CcccccccccCC...',
  '..........CcccccccCC....',
  '...........Ccccccc......',
  '............Ccc.Cc......',
  '............CC..CC......',
  '............O...O.......',
  '........................',
  '........................',
  '........................',
];

// 🐢 turtle — green with brown shell
const TURTLE: Sprite = [
  '........................',
  '........................',
  '........................',
  '........................',
  '..............lllll.....',
  '.............llllllll...',
  '.............lkllllll...',
  '..........bbblllllll....',
  '........bBBBBBbbblll....',
  '.......bBBbBBbBBbll.....',
  '......bBBBBBBBBBBBb.....',
  '......bBBbBBbBBbBBb.....',
  '......bBBBBBBBBBBBb.....',
  '......bBBbBBbBBbBBb.....',
  '......bBBBBBBBBBBBb.....',
  '......bbbbbbbbbbbbb.....',
  '......lll..ll....ll.....',
  '......lll..ll....ll.....',
  '......lll..ll....ll.....',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
];

// 🐠 fish — orange/yellow tropical fish with stripes
const FISH: Sprite = [
  '........................',
  '........................',
  '........................',
  '........................',
  '...............oo.......',
  '..............oOoO......',
  '...........ooooOoOO.....',
  '..........oooooooooO....',
  '........oOooooooooOoO...',
  '......oOooyoooyoookoOO..',  // eye on right
  '.....oOoooyyyoyyooooOOO.',
  '....oOooooyyyoyyoooooOOO',
  '.....oOoooyyyoyyooooOOO.',
  '......oOooyoooyoooooOO..',
  '........oOooooooooOoO...',
  '..........ooooooooo.....',
  '...........ooooooo......',
  '............oooo........',
  '.............oo.........',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
];

// === UNCOMMON ===

// 🦊 fox — orange with white belly + black ears
const FOX: Sprite = [
  '........................',
  '........................',
  '......oO........Oo......',
  '.....okOO......OOko.....',
  '....oOkkOO....OOkkOo....',
  '....oOoooOoooOoooOo.....',
  '...oOooooOoOoOooooOo....',
  '..oOooooooOoOoooooOOo...',
  '..oOoooooooooooooooOo...',
  '..oOokoOoooooooOoOkoO...',
  '..oOoooOooooooooOoooO...',
  '..oOoooooOoOoOOoooooO...',
  '..oOooowwwOoOwwwoooOO...',
  '...oOoowOOwowwOOwooO....',
  '....oOowwwwwwwwwwoO.....',
  '....oOowwwwwwwwwoO......',
  '.....oOwwwwwwwwoO.......',
  '......oOwwwwwwoO........',
  '......oOwwwwoO..........',
  '......oOwwoO............',
  '......oOoO..............',
  '........................',
  '........................',
  '........................',
];

// 🦨 skunk — black body with white stripe down back
const SKUNK: Sprite = [
  '........................',
  '........................',
  '........................',
  '.........kkk............',
  '........kKKKk...........',
  '.......kKwwwKk..........',
  '......kKwwwwwKk.........',  // forehead stripe
  '......kKwwwwwKk.........',
  '......kkkkkkkkk.........',
  '......kkkkkkkkk.........',
  '......kkkkkkkkkk........',
  '......kkkwkkkwkk........',  // eyes
  '......kkkkkkkkkk........',
  '....kkkkkwwwwwkkkkk.....',  // body white stripe
  '...kkkkkwwwwwwwkkkkkk...',
  '..kkkkkkwwwwwwwkkkkkkk..',
  '..kkkkkkwwwwwwwkkkkkkkw.',
  '..kkkkkwwwwwwwwwkkkkkww.',
  '..kkkkwwwwwwwwwwwkkkww..',
  '...kkkwwwwwwwwwww.kww...',  // bushy tail
  '....kkk....kkk....ww....',
  '........................',
  '........................',
  '........................',
];

// 🐍 snake — green coiled snake
const SNAKE: Sprite = [
  '........................',
  '........................',
  '......lllllllll.........',
  '.....lLlllllllllL.......',
  '....lLLllllllllllL......',
  '....lLkllllllrllllL.....',  // eye + tongue
  '....lLllllllllllllL.....',
  '....lLLllllllllllL......',
  '.....lLLLlllllLLLL......',
  '.......LLllllllL........',
  '.......LllllllL.........',
  '......LllllllL..........',
  '.....LllllllL...........',
  '....LllllllL............',
  '...LllllllL.............',
  '..LllllllL..............',
  '..Lllllll...............',
  '..LllllllL..............',
  '...LllllllL.............',
  '....LllllllL............',
  '.....LllllllL...........',
  '......LllllllL..........',
  '.......LLLLLLL..........',
  '........................',
];

// 🦎 lizard — green lizard
const LIZARD: Sprite = [
  '........................',
  '........................',
  '........................',
  '........................',
  '.................llll...',
  '................llllLl..',
  '...............llllllL..',
  '..............llkllllL..',
  '..............LllllllL..',
  '......LLLlllLllllLLll...',
  '.....LllllllllllLLll....',
  '....LlllllllllLLll......',
  '....LLLllllllLLll.......',
  '......LlllllLLll........',
  '......LllllLLll.........',
  '......LllLLLll..........',
  '......LLLll.............',
  '......LLll..............',
  '.....LLLl...............',
  '....LLLl................',
  '...LLLl.................',
  '..LLLl..................',
  '..LL....................',
  '........................',
];

// 🦇 bat — purple with wings spread
const BAT: Sprite = [
  '........................',
  '........................',
  '...P.................P..',
  '...PP...............PP..',
  '..PPPP.............PPPP.',
  '.PPPPPP.PP......PP.PPPPP',
  'PPPPPPPPPP.....PPPPPPPPP',
  'PPPPPPPPPPPpppPPPPPPPPPP',  // head start
  '.PPPPPPPPpkpkkpPPPPPPPPP',  // eyes
  '..PPPPPPPpppppPPPPPPPPP.',
  '..PPPPPPPPppwwwwppPPPPPP',  // teeth
  '...PPPPPPPpwwwwpPPPPPPP.',
  '....PPPPPPpwwppPPPPPPP..',
  '.....PPPPPpppPPPPPPPP...',
  '......PPPPPPPPPPPPPP....',
  '.......PPPPPPPPPPP......',
  '........PPPPPPPP........',
  '.........PPPPPP.........',
  '..........PPPP..........',
  '...........PP...........',
  '........................',
  '........................',
  '........................',
  '........................',
];

// 🦔 hedgehog — brown body with spikes
const HEDGEHOG: Sprite = [
  '........................',
  '........................',
  '........................',
  '...K.K.K.K.K.K.K.K......',  // spikes
  '..KbKbKbKbKbKbKbKbK.....',
  '..bKbKbKbKbKbKbKbKb.....',
  '..KbbbbbbbbbbbbbbbKb....',
  '..bbbbbbbbbbbbbbbbbbb...',
  '..bbbbbbbbbbbbbbbbbbbb..',  // body
  '...bbbbbbbbbbbbbbbbbtt..',
  '...bbbbbbbbbbbbbbtttttt.',  // face area
  '...bbbbbbbbbbttttttttt..',
  '...bbbbbbbbtttktttkttt..',  // eyes on face
  '...bbbbbbbttttttttttttp.',  // nose
  '....bbbbbttttttttttttp..',
  '.....bbbbbtttttttttt....',
  '......bbbbbbbbbbb.......',
  '.......bb..bbb.bb.......',  // feet
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
];

// 🐧 penguin — black/white with orange beak
const PENGUIN: Sprite = [
  '........................',
  '........................',
  '........kkkkkkk.........',
  '.......kkkkkkkkkk.......',
  '......kkkkkkkkkkkk......',
  '......kkkwkkkkwkkk......',  // eyes
  '......kkkkkkkkkkkk......',
  '......kkkkyyyykkkk......',  // beak
  '......kkkyyyyyykkk......',
  '......kkkkkkkkkkkk......',
  '......kkwwwwwwwwkk......',  // body white
  '......kwwwwwwwwwwk......',
  '......kwwwwwwwwwwk......',
  '......kwwwwwwwwwwk......',
  '......kwwwwwwwwwwk......',
  '......kwwwwwwwwwwk......',
  '......kwwwwwwwwwwk......',
  '......kwwwwwwwwwwk......',
  '......kwwwwwwwwwwk......',
  '......kkwwwwwwwwkk......',
  '......yyyy....yyyy......',  // feet
  '......yyyy....yyyy......',
  '........................',
  '........................',
];

// === RARE ===

// 🦡 badger — black/white striped face
const BADGER: Sprite = [
  '........................',
  '........................',
  '........................',
  '........wkwwwkw.........',  // ears
  '.......wwkwwwkww........',
  '......wwkwwwwwkww.......',
  '.....wwkwwwwwwwkww......',
  '....wwkwwwwwwwwwkww.....',
  '....wkkwwwwwwwwwkkw.....',
  '....wkwwwwwwwwwwwkw.....',
  '....wkwwkkwwwwkkwkw.....',  // eyes
  '....wkwwkkwwwwkkwkw.....',
  '....wkwwwwwkkwwwwkw.....',  // nose
  '....wwwwwwwkkwwwwwk.....',
  '....gggggggggggggggg....',  // body
  '...ggggggggggggggggggg..',
  '..ggggggggggggggggggggg.',
  '..gggGgggGgggGgggGggGgg.',
  '..gggGgggGgggGgggGggGgg.',  // dark spots
  '..ggggggggggggggggggggg.',
  '...gg..gg......gg..gg...',  // feet
  '........................',
  '........................',
  '........................',
];

// 🦌 deer — tan with antlers
const DEER: Sprite = [
  '........................',
  '...y...y............y..y',
  '...yy.yy............yyyy',
  '....yyy..............yyy',  // antlers
  '....yyy..............yyy',
  '....tttt.............ttt',
  '...ttttt.tt..........ttt',
  '...tktttttt..........ttt',  // eye
  '...ttttttt...........ttt',
  '...tttptttt..........ttt',  // nose
  '...ttttttttttttttttttttt',  // neck/back
  '...tttttttttttttttttttt.',
  '...ttwwwwwwwwwwwwwwww...',  // white belly
  '...tttttttttttttttttt...',
  '...ttttttttttttttttttt..',
  '....tt....tt....tt....tt',
  '....tt....tt....tt....tt',
  '....tt....tt....tt....tt',
  '....tt....tt....tt....tt',
  '....bb....bb....bb....bb',  // hooves
  '........................',
  '........................',
  '........................',
  '........................',
];

// 🦥 sloth — brown with darker face mask, hanging
const SLOTH: Sprite = [
  '........................',
  '........................',
  '........bbbbbbb.........',
  '.......bbbbbbbbb........',
  '......bbtttttttbb.......',
  '......btttttttttb.......',
  '......btBkBtBkBtb.......',  // mask eyes
  '......btttttttttb.......',
  '......bttBBpBBttb.......',  // mouth
  '......btttttttttb.......',
  '......bbtttttttbb.......',
  '.......bbbbbbbbb........',
  '......bbbbbbbbbbb.......',
  '.....bbbbbbbbbbbbb......',
  '.....bbbbbbbbbbbbb......',  // body
  '....bBbbbbbbbbbbbBb.....',
  '....bBbbbbbbbbbbbBb.....',
  '....BBbbbbbbbbbbbBB.....',  // arms hanging
  '....BBbbbbbbbbbbbBB.....',
  '...BBBbbb.....bbbBBB....',
  '..BBBBb.........bBBBB...',  // claws
  '..BB...............BB...',
  '........................',
  '........................',
];

// 🦉 owl — brown with huge eyes
const OWL: Sprite = [
  '........................',
  '........................',
  '......BB...........BB...',
  '.....BbB...........BbB..',  // ear tufts
  '....BbbbB.........BbbbB.',
  '....BbbbbB.......BbbbbB.',
  '....BbbbbbBbbbbbBbbbbbB.',
  '....bbbbbbbbbbbbbbbbbb..',
  '....bwwwbbbbbbbbbbwwwb..',
  '....bwkwbbbbbbbbbbwkwb..',  // big eyes
  '....bwwwbbbbbbbbbbwwwb..',
  '....bbbbbbbyybbbbbbbbb..',  // beak
  '....bbbbbbbyybbbbbbbbb..',
  '....BbbbbBbbBBbbbBbbbB..',  // chest pattern
  '....BBbbBBbbbbbbBBbbBB..',
  '.....BbbBBbbBBbbBBbbB...',
  '.....BBBBBBBBBBBBBBBB...',
  '......BBBBBBBBBBBBBB....',
  '.......BBBBBBBBBBBB.....',
  '........yy......yy......',  // talons
  '........................',
  '........................',
  '........................',
  '........................',
];

// 🦅 eagle — brown body, white head, yellow beak
const EAGLE: Sprite = [
  '........................',
  '........................',
  '........wwwwwww.........',
  '.......wwwwwwwww........',
  '......wwwwwwwwwww.......',
  '......wkwwwwwwwkw.......',  // eyes
  '......wwwwwwwwwww.......',
  '.....wwwwwyyyywwwww.....',  // beak
  '.....wwwwyyyyyywwww.....',
  '.....wwwwwwwwwwwwww.....',
  '....bbbbbbbbbbbbbbbb....',
  '..bbbbbbbbbbbbbbbbbbbb..',  // wings spread
  '.bbbbbbbbbbbbbbbbbbbbbb.',
  'bbBBbbbbbbbbbbbbbbbbBBbb',
  'bBBBBbbbbbbbbbbbbbbBBBBb',  // wing tips
  '.bBBBbbbbbbbbbbbbbbBBBb.',
  '..bBBbbbbbbbbbbbbbbBBb..',
  '...bbbbbbbbbbbbbbbbbb...',
  '....bbbbbbbbbbbbbbbb....',
  '.....bbBBBBBBBBBBBb.....',
  '.......yy......yy.......',  // talons
  '........................',
  '........................',
  '........................',
];

// 🦘 kangaroo — tan with big legs, side view
const KANGAROO: Sprite = [
  '........................',
  '..........tt............',
  '.........tttt...........',
  '.........tkttt..........',  // head
  '.........ttttt..........',
  '.........tprtt..........',  // nose
  '..........tttt..........',
  '...........tt...........',
  '..........tttt..........',
  '.........ttttt..........',  // neck
  '.........tttttt.........',
  '........ttttttt..tt.....',
  '.......tttttttttttt.....',  // body
  '......tttttttttttttt....',
  '......tttttttttttttt....',
  '......ttttttttttttt.....',
  '......tttttttttttt.tttt.',  // tail
  '......ttttttttt...ttttt.',
  '......ttttt..tt....ttt..',  // pouch + legs
  '......ttt.....tttt......',
  '......ttt.......ttt.....',  // legs
  '......ttt.........ttt...',
  '......bbb.........bbb...',  // feet
  '........................',
];

// 🦦 otter — brown, swimming
const OTTER: Sprite = [
  '........................',
  '........................',
  '........................',
  '............bbbbb.......',
  '...........bbbbbbb......',
  '...........bbkbbbkb.....',  // eyes
  '...........bbbbbbbb.....',
  '...........bbbpbbbb.....',  // nose
  '...........bbbbbbb......',
  '......bbbbbbbbbbbbb.....',  // body
  '.....bbbbbbbbbbbbbbbb...',
  '....bbBBBBBBBBBBBBBbbb..',
  '....bbBBwwwwwwwwwBBbbbb.',  // belly
  '....bbBBwwwwwwwwwBBbbbbb',
  '....bbBBwwwwwwwwwBBbbbb.',
  '....bbBBBBBBBBBBBBBbbb..',
  '.....bbbbbbbbbbbbbbb....',
  '.....bb.bb......bb.bb...',  // legs
  '......b..b.......b..b...',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
];

// 🦫 beaver — brown with big flat tail
const BEAVER: Sprite = [
  '........................',
  '........................',
  '........................',
  '.........bbbbbbbb.......',
  '........bbbbbbbbbb......',
  '........bbkbbbbkbb......',  // eyes
  '........bbbbbbbbbb......',
  '........bbbBBBBbbb......',  // nose
  '........bbBwwwwBbb......',  // teeth
  '........bbBwwwwBbb......',
  '........bbbBBBBbbb......',
  '......bbbbbbbbbbbbbb....',  // body
  '.....bbbbbbbbbbbbbbbb...',
  '.....bbbbbbbbbbbbbbbbB..',
  '....bbbbbbbbbbbbbbbBBBB.',  // tail
  '....bbbbbbbbbbbbbBBBBBBB',
  '....bbbbbbbbbbbbBBBBBBBB',
  '....bbbbbbbbbbbBBBBBBBBB',
  '.....bbbbbbbbbBBBBBBBBB.',
  '......bbbbbbBBBBBBBBBB..',
  '.......bb..bb...........',  // feet
  '........................',
  '........................',
  '........................',
];

// === EPIC ===

// 🐅 tiger — orange with black stripes
const TIGER: Sprite = [
  '........................',
  '........................',
  '......oo........oo......',
  '.....oOOo......oOOo.....',
  '....oOkkOo....oOkkOo....',
  '....oOoooOoooooooooo....',
  '...oOokkookoooookkookOo.',  // stripes on head
  '..oOoooooooooooooooooOo.',
  '..okkoooookoooookkkkokOo',
  '..oOookOoOoOoOoOoOoOoOo.',  // eyes
  '..oOoooooOoOoOoOoOoOoOo.',
  '..oOoookkkpwppkkooooOo..',  // mouth
  '..ookkkkooowwooookkkkoo.',  // stripes
  '...ooooooooooooooooooo..',
  '....oooookkkkkkkoooo....',
  '...ooookkkooooooookkooo.',  // body stripes
  '..oooooooooooooooooooo..',
  '..ookkkooookooookkkkooo.',
  '...ooooooooooooooooooo..',
  '....oo..oo....oo..oo....',  // legs
  '....bb..bb....bb..bb....',
  '........................',
  '........................',
  '........................',
];

// 🐘 elephant — gray with tusks and trunk
const ELEPHANT: Sprite = [
  '........................',
  '........................',
  '....GGGGG.....GGGGG.....',  // ears
  '...GgggggG...GgggggG....',
  '..GgggggggG.GgggggggG...',
  '..Gggggggggggggggggggg..',
  '..Ggggggggggggggggggggg.',
  '..Gggkggggggggggggkggg..',  // eyes
  '..Gggggggggggggggggggg..',
  '..Gggggggggggggggggggg..',
  '..Ggggggggggggggggggggg.',
  '..GgggggggggggggggggggG.',  // body
  '..GgggggggggggggggGGGG..',
  '..GgggggggggggggGG.GG...',  // trunk
  '..GgggggggggggGG..G.....',
  '..GggggggggggGG.........',
  '..Gggggggggggw..........',  // tusk
  '..ggggggggggw...........',
  '..gggggggggg............',
  '..gg..gg.gg.gg..........',  // legs
  '..gg..gg.gg.gg..........',
  '........................',
  '........................',
  '........................',
];

// 🐊 crocodile — green long body, jagged teeth
const CROCODILE: Sprite = [
  '........................',
  '........................',
  '........................',
  '........................',
  '............LLLLLLLL....',
  '...........LllllllllLL..',
  '..........LllllkllllllL.',  // eye
  '.........LlllllllllllllL',
  '.LLLLLLLLwlwlwlwlwlwlwLL',  // teeth row
  'LllllllllllllllllllllLL.',
  'LlllllllllllllllllllLL..',
  'LllllllllllllllllllL....',
  '.LLLLLLLLLLLLLLLLLLL....',
  '...L.L.L.L.L.L.L.L.L....',  // ridges
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
  '........................',
];

// 🦈 shark — gray with dorsal fin
const SHARK: Sprite = [
  '........................',
  '........................',
  '........................',
  '...........G............',
  '..........GgG...........',
  '.........GgggG..........',  // dorsal fin
  '........GggggggG........',
  '.......GggggggggG.......',
  '......GgggggggggGG......',
  '....GGggggggggggggGG....',
  '...GggggggggggggggggG...',
  '..GgggggggggggggwkggGg..',  // eye, gill
  '.GggggggggggggggggggGgg.',
  'Gggggggggggggggwwwwwwwgg',  // mouth/teeth
  'Ggggggggggggggwwwwwww...',
  '.GggggggggggggGGGGG.....',
  '..GGggggggGGGGG.........',
  '....GGGGGGG.............',
  'G......G.....GG.........',  // bottom fins
  'GG....GG.....GGG........',
  '........................',
  '........................',
  '........................',
  '........................',
];

// 🦒 giraffe — yellow with brown spots, long neck
const GIRAFFE: Sprite = [
  '........................',
  '..........yy............',
  '.........yyyy...........',
  '.........yyyy...........',
  '.........yykyy..........',  // head with eye
  '.........yyyyy..........',
  '..........yyy...........',
  '..........yyy...........',
  '..........yYy...........',  // brown spot
  '..........yyy...........',
  '..........yyy...........',  // long neck
  '..........yYy...........',
  '..........yyy...........',
  '..........yyyyy.........',
  '.........yyyyyyy........',
  '........yyYyyyYyyy......',
  '.......yyyyyyyyyyyy.....',  // body
  '.......yYyyyyYyyyYy.....',
  '.......yyyyyyyyyyyy.....',
  '.......yYyyyyyyyYyy.....',
  '.......yy..yy..yy.yy....',
  '.......yy..yy..yy.yy....',  // legs
  '.......BB..BB..BB.BB....',  // hooves
  '........................',
];

// 🦚 peacock — blue body with fan tail
const PEACOCK: Sprite = [
  '........................',
  '..........y.............',
  '.........cyc............',  // crest
  '.........yky............',  // eye
  '..........y.............',
  '..........C.............',
  '.........CCC............',  // neck
  '........CCCCC...........',
  '.......CCCCCCC..........',
  '......CCCCCCCCC.........',  // body
  '.....CCCCCCCCCCC........',
  '....lClClClClClC........',  // fan start
  '...lLlLlLlLlLlLl........',
  '..lyLyLyLyLyLyLyl.......',
  '.lyclLclLclLclLcly......',  // eye-spots on fan
  'lcLclcLclcLclcLclcL.....',
  'lcLcLcLcLcLcLcLcLcLC....',
  '.lcLcLcLcLcLcLcLcLC.....',  // tail spreading
  '..lLcLclclclclLcLC......',
  '...lLcLcLcLcLcLC........',
  '....lCcCcCcCcCC.........',
  '.....llllllllll.........',
  '........................',
  '........................',
];

// 🦬 bison — brown with shaggy head and hump
const BISON: Sprite = [
  '........................',
  '........................',
  '........................',
  '....BBBB................',  // shaggy head
  '...BbbbBB...............',
  '..BBbbbbbB..............',
  '.BBbbkbbbbB.............',  // eye
  '.BbbbbbbbbB.............',
  '.BbbBBBBbbB.............',  // horns
  'BBbbbbBbbBBB............',
  'BbbbbbpbbbB.............',  // nose
  '.BBBBBBBBBB.............',
  '...bbbbbbbbbbbbbbb......',
  '..bbbbbbbbbbbbbbbbb.....',  // body
  '..bbbbBBBBBBBBbbbbbb....',
  '..bbbBBBBBBBBBBbbbbbbB..',  // hump
  '..bbbbbbbbbbbbbbbbbbBB..',
  '..bbbbbbbbbbbbbbbbbb....',
  '..bbbbbbbbbbbbbbbbbb....',
  '..bb..bb.....bb..bb.....',  // legs
  '..bb..bb.....bb..bb.....',
  '..BB..BB.....BB..BB.....',
  '........................',
  '........................',
];

export const SPRITES: Record<string, Sprite> = {
  // legendary
  '🐉': DRAGON,
  '🦄': UNICORN,
  '🧜': MERMAID,
  '🦖': TREX,
  '🦕': SAUROPOD,
  '🐙': OCTOPUS,
  // epic
  '🐅': TIGER,
  '🐘': ELEPHANT,
  '🐊': CROCODILE,
  '🦈': SHARK,
  '🦒': GIRAFFE,
  '🦚': PEACOCK,
  '🦬': BISON,
  // rare
  '🦡': BADGER,
  '🦌': DEER,
  '🦥': SLOTH,
  '🦉': OWL,
  '🦅': EAGLE,
  '🦘': KANGAROO,
  '🦦': OTTER,
  '🦫': BEAVER,
  // uncommon
  '🦊': FOX,
  '🦨': SKUNK,
  '🐍': SNAKE,
  '🦎': LIZARD,
  '🦇': BAT,
  '🦔': HEDGEHOG,
  '🐧': PENGUIN,
  // common
  '🐕': DOG,
  '🐈': CAT,
  '🐇': RABBIT,
  '🐁': MOUSE,
  '🐀': RAT,
  '🐦': BIRD,
  '🐢': TURTLE,
  '🐠': FISH,
};

export const hasSprite = (species: string): boolean => species in SPRITES;
