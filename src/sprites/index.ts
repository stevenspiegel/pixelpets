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

export const SPRITES: Record<string, Sprite> = {
  '🐉': DRAGON,
  '🦄': UNICORN,
  '🧜': MERMAID,
  '🦖': TREX,
  '🦕': SAUROPOD,
  '🐙': OCTOPUS,
  '🐈': CAT,
  '🐕': DOG,
};

export const hasSprite = (species: string): boolean => species in SPRITES;
