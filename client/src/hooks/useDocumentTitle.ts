import { useEffect } from 'react';

/** Sets the browser tab title of the page: `QuizRoom — <title>`. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `QuizRoom — ${title}`;
  }, [title]);
}
