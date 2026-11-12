import { Logo } from '../../components/ui/Logo';
import { Screen } from '../../components/ui/Screen';
import type { PlayerScreenProps } from './props';
import styles from './PlayerLobby.module.css';

/** Phase `lobby`: the player is in the room and waits for the host to start the game. */
export function PlayerLobby({ state }: PlayerScreenProps) {
  return (
    <Screen variant="phone">
      <div className={styles.logo}>
        <Logo />
      </div>

      <div className={styles.body}>
        <p className={styles.title}>Ти в грі!</p>
        <h1 className={styles.name}>{state.me.name}</h1>
        {/* &nbsp; keeps the dash at the end of a line instead of the start of the next one. */}
        <p className={styles.hint}>Дивись на головний екран&nbsp;— гра ось-ось почнеться</p>
      </div>

      <p className={styles.count}>Гравців у кімнаті: {state.playerCount}</p>
    </Screen>
  );
}
