import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Notice } from '../components/ui/Notice';
import { hostFixtures, playerFixtures } from '../fixtures/states';
import { HostPreview } from './dev/HostPreview';
import { PlayerPreview } from './dev/PlayerPreview';
import { UiKitShowcase } from './dev/UiKitShowcase';
import styles from './DevGalleryPage.module.css';

// Not a fixture of its own: the `question-4` snapshot after the time has run out.
const LOCKED_KEY = 'question-4-locked';

// Screen id in the address is `<group>/<key>`: the host and the player have fixtures with equal keys.
const GROUPS = [
  { id: 'ui', title: 'UI-кіт', keys: ['kit'] },
  { id: 'host', title: 'Ведучий', keys: Object.keys(hostFixtures) },
  {
    id: 'player',
    title: 'Гравець',
    keys: Object.keys(playerFixtures).flatMap((key) => (key === 'question-4' ? [key, LOCKED_KEY] : [key])),
  },
];

// Host screens are made for a projector: they are previewed in a 16:9 frame of this size.
const STAGE_FRAME = { width: 1280, height: 720 };
// Player screens are previewed in the frame of a small, a usual and a large phone.
const PHONE_FRAMES = [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

/**
 * Development-only gallery: every screen in every state, drawn from fixtures without a server.
 * `?screen=host/question-4` picks the screen; `&view=full` shows it alone on the whole page.
 */
export function DevGalleryPage() {
  const [params] = useSearchParams();
  const screen = params.get('screen') ?? 'ui/kit';
  const view = params.get('view');
  const [phoneFrame, setPhoneFrame] = useState(PHONE_FRAMES[1]);
  const isPlayer = screen.startsWith('player/');
  const frame = isPlayer ? phoneFrame : STAGE_FRAME;

  // The bare screen: `view=full` is the "full screen" switch, `view=frame` is what a frame loads.
  if (view !== null) {
    return (
      <>
        <GalleryScreen id={screen} />
        {view === 'full' && (
          <Link className={styles.exit} to={`/dev?screen=${screen}`} title="Вийти з повного екрана">
            ✕
          </Link>
        )}
      </>
    );
  }

  return (
    <div className={styles.gallery}>
      <nav className={styles.nav}>
        <Link className={styles.fullLink} to={`/dev?screen=${screen}&view=full`}>
          На весь екран
        </Link>
        {isPlayer && (
          <div className={styles.sizes} role="group" aria-label="Розмір рамки телефона">
            {PHONE_FRAMES.map((size) => (
              <button
                key={size.width}
                type="button"
                className={size === phoneFrame ? `${styles.size} ${styles.active}` : styles.size}
                onClick={() => setPhoneFrame(size)}
              >
                {size.width}×{size.height}
              </button>
            ))}
          </div>
        )}
        {GROUPS.map((group) => (
          <section key={group.id}>
            <h2 className={styles.groupTitle}>{group.title}</h2>
            {group.keys.length === 0 && <p className={styles.empty}>Екранів ще немає</p>}
            <ul className={styles.links}>
              {group.keys.map((key) => {
                const id = `${group.id}/${key}`;
                return (
                  <li key={id}>
                    <Link
                      className={id === screen ? `${styles.link} ${styles.active}` : styles.link}
                      to={`/dev?screen=${id}`}
                    >
                      {key}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </nav>

      <div className={styles.preview}>
        {screen.startsWith('ui/') ? (
          <GalleryScreen id={screen} />
        ) : (
          <Frame src={`/dev?screen=${screen}&view=frame`} width={frame.width} height={frame.height} />
        )}
      </div>
    </div>
  );
}

/** Draws one gallery screen by its id, e.g. `ui/kit` or `host/question-4`. */
function GalleryScreen({ id }: { id: string }) {
  const [group, key = ''] = id.split('/');

  if (id === 'ui/kit') return <UiKitShowcase />;
  if (group === 'host' && Object.hasOwn(hostFixtures, key)) {
    // The key remounts the preview for every fixture, so each one starts its own timer.
    return <HostPreview key={key} fixture={hostFixtures[key]} />;
  }
  if (group === 'player' && key === LOCKED_KEY) {
    return <PlayerPreview key={key} fixture={playerFixtures['question-4']} locked />;
  }
  if (group === 'player' && Object.hasOwn(playerFixtures, key)) {
    return <PlayerPreview key={key} fixture={playerFixtures[key]} />;
  }
  return (
    <div className={styles.unknown}>
      <Notice tone="error">Невідомий екран: {id}</Notice>
    </div>
  );
}

type FrameProps = { src: string; width: number; height: number };

/**
 * A page inside an iframe of a fixed size, scaled to fit the free space.
 * An iframe has its own viewport: `vw`, `dvh` and media queries of the screen inside are counted
 * from the frame, exactly as on a real projector or phone of that size.
 */
function Frame({ src, width, height }: FrameProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const box = boxRef.current;
    if (box === null) return;
    // Fires right after `observe` and then on every change of the free space.
    const observer = new ResizeObserver(() => {
      setScale(Math.min(box.clientWidth / width, box.clientHeight / height));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, [width, height]);

  return (
    <div className={styles.frameBox} ref={boxRef}>
      {/* `transform` does not change the size an element takes in the layout, so this box does it. */}
      <div className={styles.frameSize} style={{ width: width * scale, height: height * scale }}>
        <iframe
          // A new iframe per screen: changing `src` of the old one would add an entry to the browser history.
          key={src}
          className={styles.frame}
          title={src}
          src={src}
          style={{ width, height, transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
}
