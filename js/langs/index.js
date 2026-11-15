// Language plug-ins. Every plug-in default-exports an object with this shape:
//
//   code, name          ISO code and the language's own name
//   articles: Set       words dropped when "skip articles" is on
//   markers: Set        frequent function words, used for language detection
//   chars?: RegExp      characters that point to this language (also used for detection)
//   particles?: Set     words that are always dropped (e.g. French "ne")
//   capitalNoun?: bool  nouns are capitalised (German)
//   foldFallback?: bool accent-insensitive lookup if nothing else matched
//   lemmas(word, {sentenceStart}) -> [{lemma, feat}]   candidate base forms, best first
//                       feat: pos n|v|a, pl, past, part, partAmb, fut, inf, irreg
//   variants?(lowerWord) -> [spellings]                 e.g. German ae -> ä, Esperanto cx -> ĉ
//   expand?(word, known) -> [words] | null              contractions / clitics ("j'ai", "del", "don't")
//   compound?(word, resolve) -> {head, modifier, ...}   unknown compound splitter
//   verbCues?: Set      words after which an ambiguous word is read as a verb
//   contextHint?(word, previousWord) -> "n" | "v" | null
//   isInfinitive?(tok), pastIsParticiple?               how to recognise infinitives / participles
//   grammar?(toks, i, g)                                auxiliaries -> tense indicators
import de from "./de.js";
import en from "./en.js";
import fr from "./fr.js";
import es from "./es.js";
import it from "./it.js";
import pt from "./pt.js";
import eo from "./eo.js";

export const LANGS = { de, en, fr, es, it, pt, eo };
export const CODES = Object.keys(LANGS);
