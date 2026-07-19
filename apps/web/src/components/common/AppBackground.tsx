import './AppBackground.scss';

export function AppBackground() {
  return (
    <div className="app-background" aria-hidden="true">
      <span className="app-background__pixel app-background__pixel--cyan" />
      <span className="app-background__pixel app-background__pixel--pink" />
      <span className="app-background__pixel app-background__pixel--purple" />
    </div>
  );
}
