import type { Metadata } from "next";
import Image from "next/image";
import { Baloo_2, Caveat, Hind } from "next/font/google";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import styles from "./page.module.css";

const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-shinchan-baloo",
});

const hind = Hind({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-shinchan-hind",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-shinchan-caveat",
});

export const metadata: Metadata = {
  title: {
    absolute: "Shinchan \\ OpenForum",
  },
  description:
    "A dedicated OpenForum tribute post celebrating Shinchan and the nostalgia of growing up with him.",
};

const characterCards = [
  {
    name: "Misae Nohara",
    role: "Mama",
    image: "/shinchan/Misae_Nohara.png",
    description:
      "The real backbone of the show. Exasperated, loud, funny, and endlessly loving.",
  },
  {
    name: "Hiroshi Nohara",
    role: "Papa",
    image: "/shinchan/Hiroshi_Nohara.png",
    description:
      "Office tired and secretly soft-hearted. Every middle-class dad saw himself in him.",
  },
  {
    name: "Himawari",
    role: "Baby Sister",
    image: "/shinchan/Himawari.png",
    description:
      "Tiny, dangerous, and obsessed with shiny things. A legend before kindergarten.",
  },
  {
    name: "Shiro",
    role: "Good Boy",
    image: "/shinchan/Shiro.png",
    description:
      "A patient soul trapped in the Nohara circus. The most relatable character of all.",
  },
];

export default function ShinchanBlogPage() {
  return (
    <div className={`${styles.page} ${baloo.variable} ${hind.variable} ${caveat.variable}`}>
      <Navbar />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroBgPattern} />
          <div className={styles.heroDots} />

          <div className={styles.heroContent}>
            <div className={styles.heroEyebrow}>Nostalgia Overloaded</div>
            <h1>
              Shinchan - The Tiny <span>Chaos God</span> of Our Indian Childhoods
            </h1>
            <p className={styles.heroSub}>
              How a mischievous five-year-old Japanese boy in red shorts conquered
              living rooms, hearts, and the beautiful chaos of growing up in India.
            </p>

            <div className={styles.heroMeta}>
              <span className={styles.heroTag}>Anime and Nostalgia</span>
              <span className={styles.heroDate}>April 2026</span>
              <span className={styles.heroRead}>20-25 min read</span>
            </div>
          </div>
        </section>

        <div className={styles.squiggle}>
          <svg
            viewBox="0 0 1440 60"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            height="60"
            aria-hidden="true"
          >
            <path d="M0,0 C360,60 1080,0 1440,60 L1440,0 L0,0 Z" fill="#FFFDF5" />
          </svg>
        </div>

        <div className={styles.container}>
          <article className={styles.articleBody}>
            <p>
              Close your eyes for a second. It is a scorching summer afternoon somewhere
              in India. You are home from school, bag still on your back, and somehow
              already five inches from the TV. The jingle starts, chaos begins, and for
              the next twenty-three minutes the world pauses. <span className={styles.inlineHighlight}>Shinchan has arrived.</span>
            </p>

            <p>
              That was the magic of <em>Crayon Shin-chan</em>. For Indian kids in the
              2000s and early 2010s, this was not just a cartoon. It was a shared language
              across schools, cities, and friend groups.
            </p>

            <div className={styles.pullquote}>
              <p>
                &ldquo;Shinchan did not just entertain us. He raised us in all the wrong,
                wonderful, chaotic ways.&rdquo;
              </p>
            </div>

            <p>
              This page is a loud love letter to a five-year-old in a red shirt and yellow
              shorts who reminded an entire generation that life is better when you stop
              taking yourself too seriously.
            </p>

            <div className={styles.funFact}>
              <div className={styles.funFactIcon}>Note</div>
              <div>
                <strong>Did You Know?</strong>
                <p>
                  Crayon Shin-chan started as a manga in 1990 and anime in 1992. It
                  reached India later, but once it did, it exploded into pop culture.
                </p>
              </div>
            </div>

            <h2>The Arrival That Changed Everything</h2>

            <p>
              Indian TV in the early 2000s was chaotic and unforgettable. Cartoon Network
              and Pogo felt like secret portals into a world built just for kids.
            </p>

            <p>
              Then came Shinchan in Hindi. The dubbing did not just translate lines - it
              adapted rhythm, idioms, and desi comic timing so naturally that the show felt
              local.
            </p>

            <p>
              A Japanese suburban family in Kasukabe suddenly felt like the family next
              door in India. That cultural jump is the first miracle of Shinchan.
            </p>

            <div className={styles.nostalgiaCard}>
              <div className={styles.nostalgiaHeader}>The Great Indian Shinchan Ritual</div>
              <div className={styles.nostalgiaBody}>
                <p>
                  Homework was completed at record speed only because the episode timing
                  was non-negotiable. Lunch happened with eyes on the screen. Siblings made
                  temporary peace treaties to protect the remote.
                </p>
                <p>
                  On lucky days, parents sat &ldquo;just for a minute&rdquo; and watched the full episode.
                </p>
              </div>
            </div>

            <h2>Who Is Shinchan, Really?</h2>

            <p>
              On paper, Shinnosuke Nohara sounds like a parenting nightmare: loud,
              shameless, impulsive, and impossible to control. Yet somehow, everyone loves him.
            </p>

            <p>
              The reason is simple: he is completely himself. No social mask. No performance.
              Just honest childhood chaos with fearless confidence.
            </p>

            <h3>The Nohara Family</h3>

            <div className={styles.charGrid}>
              {characterCards.map((character) => (
                <div className={styles.charCard} key={character.name}>
                  <Image
                    className={styles.charHead}
                    src={character.image}
                    alt={character.name}
                    width={72}
                    height={72}
                  />
                  <div className={styles.charName}>{character.name}</div>
                  <div className={styles.charRole}>{character.role}</div>
                  <div className={styles.charDesc}>{character.description}</div>
                </div>
              ))}
            </div>

            <p>
              The Noharas matched Indian middle-class life surprisingly well: salary pressure,
              budget stress, neighborhood expectations, family drama, and everyday laughter.
            </p>

            <h2>The Humour That Crossed Every Boundary</h2>

            <p>
              For kids, Shinchan was funny because it was absurd and loud. For adults,
              it was satire about social rules, work life, marriage, and public image.
            </p>

            <div className={styles.highlightBox}>
              <h3>The Hidden Genius</h3>
              <p>
                Shinchan&apos;s humour often points at adult insecurity, not childish stupidity.
                The joke is usually on the world pretending to be serious.
              </p>
            </div>

            <p>
              Many one-liners aged with us. What made us laugh as children became even funnier
              once we understood the deeper joke as adults.
            </p>

            <h2>How Shinchan Became Desi</h2>

            <p>
              Hindi dubbing gave Shinchan a second life in India. Voice acting, cadence, and
              localized expressions made it feel native.
            </p>

            <p>
              For many viewers in India, dubbed Shinchan is not an alternate version - it is
              the definitive version.
            </p>

            <div className={styles.memoryStrip}>
              <p>
                Every viewer remembers at least one iconic Hindi dialogue they repeated for months.
              </p>
            </div>

            <h2>The Complicated &ldquo;Ban&rdquo; Years</h2>

            <p>
              Shinchan also triggered repeated controversy in India. Critics argued that his
              behavior was a bad influence on children.
            </p>

            <div className={styles.funFact}>
              <div className={styles.funFactIcon}>Alert</div>
              <div>
                <strong>The Great Controversy</strong>
                <p>
                  Complaints, debates, and public concern came in waves. Yet the show survived,
                  because audiences kept coming back.
                </p>
              </div>
            </div>

            <p>
              In hindsight, the show taught less disobedience and more resilience, humor,
              and emotional honesty.
            </p>

            <h2>What Shinchan Actually Taught Us</h2>

            <h3>The Art of Being Unbothered</h3>
            <p>
              Shinchan does not perform social perfection. He exists loudly and unapologetically.
              That freedom was strangely healing for kids who were constantly told to behave.
            </p>

            <h3>Love in Noisy, Imperfect Ways</h3>
            <p>
              The Nohara family is loud and flawed, but deeply loving. That imperfect love
              looked very familiar to Indian homes.
            </p>

            <div className={styles.pullquote}>
              <p>
                &ldquo;Family love in Shinchan was not polished. It was messy, funny, and real.&rdquo;
              </p>
            </div>

            <h3>Nothing Is Too Serious to Laugh At</h3>
            <p>
              The show repeatedly teaches emotional flexibility: laugh, adapt, and continue.
              That mindset matters even more in adulthood.
            </p>

            <h2>The Movies and the Emotional Depth</h2>

            <p>
              Shinchan films expanded the universe with stories that were surprisingly mature.
              <em> The Adult Empire Strikes Back </em> is still one of the strongest reflections
              on nostalgia in animation.
            </p>

            <div className={styles.funFact}>
              <div className={styles.funFactIcon}>Film</div>
              <div>
                <strong>A Hidden Masterpiece</strong>
                <p>
                  Many viewers discover these films later in life and come away deeply moved,
                  not just entertained.
                </p>
              </div>
            </div>

            <h2>The Meme Renaissance</h2>

            <p>
              In the internet era, Shinchan did not fade. It became meme language across
              WhatsApp, reels, and short-form videos.
            </p>

            <div className={styles.highlightBox}>
              <h3>Why It Still Works</h3>
              <p>
                Childhood chaos, middle-class anxiety, and family comedy are timeless. Shinchan
                is built on truths that do not expire.
              </p>
            </div>

            <h2>Legacy in Indian Pop Culture</h2>

            <p>
              Shinchan references show up in stand-up, social media, office banter, and daily
              speech. Calling someone &ldquo;a Shinchan&rdquo; still communicates a full personality in one phrase.
            </p>

            <div className={styles.sectionBanner}>
              <h2>The Kasukabe-to-India Connection</h2>
              <p>
                Different geographies, same social energy: neighborhood pressure, family ambitions,
                and chaos held together with humor.
              </p>
            </div>

            <h2>A Note on Yoshito Usui</h2>

            <p>
              The creator of Crayon Shin-chan, Yoshito Usui, passed away in 2009. His work,
              however, kept growing and touching new generations.
            </p>

            <p>
              That continuation feels fitting for a character who never accepted endings and
              always chose motion, noise, and life.
            </p>

            <h2>For Us, as Adults</h2>

            <p>
              We grew up, but Shinchan stayed exactly as he needed to be. The show still works
              because the emotional truths still work.
            </p>

            <div className={styles.pullquote}>
              <p>
                &ldquo;Somewhere between school uniforms and office emails, we all misplaced a little
                bit of Shinchan.&rdquo;
              </p>
            </div>

            <p>
              Maybe the goal is not to become less childish. Maybe it is to recover the courage
              to be a little more honest, playful, and alive.
            </p>

            <div className={styles.sectionDivider}>*</div>

            <div className={styles.conclusion}>
              <h2>Thank You, Shinchan</h2>
              <p>
                For a generation of Indian kids, Shinchan was never just a cartoon. He was a
                companion, a comedian, and an accidental philosopher.
              </p>
              <p>
                The Noharas became our family. Their living room felt like ours. Their chaos
                taught us to laugh through our own.
              </p>
              <p>
                Here is to the boy who kept dancing, kept saying the unsayable, and kept proving
                that joy is a serious thing.
              </p>
              <p>We grew up. He did not. That is exactly why he still matters.</p>
              <div className={styles.conclusionSig}>Nanako ga daisuki dazo.</div>
            </div>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}
