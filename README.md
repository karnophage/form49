# Form 49

A small *Papers, Please*-style desk game set in the First Court of the Chinese Buddhist underworld (Diyu). You're a dead clerk working off your own karmic debt by processing other dead people's paperwork.

Each soul arrives with a **Case File** and an extract from the **Book of Life and Death**. You check the two against each other, add up their deeds, and stamp one of three verdicts:

- **Rebirth**: forward them to the 10th Court (King Zhuanlun), which handles reincarnation.
- **Hell**: refer them to one of Courts 2 to 9, chosen by their single worst deed.
- **Return to sender**: someone collected the wrong person, or collected them early.

There are three days. Each one adds a rule (Filial Piety Week doubles unfilial deeds, then temple merit certificates arrive and half are forged). Bribes are offered. The Censorate audits. At the end, your own file gets judged by the same rules you've been applying all week.

## Running it

It's plain HTML, CSS and JavaScript with no build step.

- **Quickest:** open `index.html` in a browser.
- **On your phone, from your computer:** run `python3 -m http.server 8000` in this folder, then open `http://<your-computer's-IP>:8000` on your phone (same Wi-Fi).

Keyboard: `1` Rebirth, `2` Hell (then `2` to `9` for the court), `3` Return, `B` take the bribe.

## Where things live

| File | What's in it | Edit it when you want to... |
|---|---|---|
| `data.js` | Every name, deed, joke, special soul, day, rule and price | add content. **Start here.** |
| `game.js` | The rules (`judge()`), soul generation, the pixel-art scene, input | change how the game plays |
| `style.css` | Layout and look | change how it looks |
| `index.html` | Page structure | add new UI elements |

A few easy first changes to try:

1. Add a deed to `GOOD_DEEDS` or `BAD_DEEDS` in `data.js`.
2. Write a new special soul in `SPECIALS` and slot it into a day's `specials` (the number is its position in the queue, starting at 0).
3. Change `DAY_SECONDS` at the top of `game.js` to make days longer or shorter.

## About the source material

The setting is real, the details are played for laughs.

- **Real:** the Ten Kings and their names, the Book of Life and Death, Ox-Head and Horse-Face, Meng Po's soup of forgetting, hell bank notes, and the 49-day mourning period that gives the game its name. In folk tradition Yama really was demoted from the First Court to the Fifth for being too lenient.
- **Made up for the game:** which sins go to which court (the traditional lists vary by text and are much grimmer), the sentences, the certificates and every rule in the Rulebook.

Further reading: Stephen F. Teiser, *The Scripture on the Ten Kings and the Making of Purgatory in Medieval Chinese Buddhism* (University of Hawai'i Press, 1994), and the Wikipedia article on [Diyu](https://en.wikipedia.org/wiki/Diyu).
