/**
 * iPhone's "Add to Home Screen" ignores the manifest's start_url and saves
 * whatever page was open — this one — as the app's start page. So when this
 * page loads inside the installed app, skip the instructions and go
 * straight into the app (to signup, carrying the invite code, if they
 * haven't got an account yet).
 *
 * An inline script rather than a useEffect: it runs while the HTML is still
 * being parsed, before anything below it is painted, so the instructions
 * never flash up first. Rendered at the top of the page for that reason.
 */
export function OpenInstalledApp({ target }: { target: string }) {
  const script = `(function(){
    var standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    if (standalone) {
      document.documentElement.style.visibility = "hidden";
      window.location.replace(${JSON.stringify(target)});
    }
  })();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
