import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * The web page shell (static rendering) — Expo's default, plus the app icon
 * links and one small script. Email links from Supabase (confirm sign-up,
 * reset password) come back with tokens in the URL fragment. The script
 * moves the fragment into page memory before any app code runs, so the
 * router never sees it and can't write the tokens back into the address bar
 * or history. The account code reads it once on start (see AccountProvider)
 * and drops it.
 */
const TAKE_AUTH_LINK = `(function(){try{var h=location.hash;if(/(^#|&)(access_token|error_code|error)=/.test(h)){window.__formtimeAuthLink=h;history.replaceState(history.state,'',location.pathname+location.search);}}catch(e){}})();`;

export default function Root({ children }: PropsWithChildren) {
  const { bodyAttributes, bodyNodes, htmlAttributes, headNodes } = useServerDocumentContext();
  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* The FORM / TIME mark: sharp at any size, and on iPhone home screens. */}
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <script dangerouslySetInnerHTML={{ __html: TAKE_AUTH_LINK }} />
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
