export default {
  async fetch() {
    return new Response(
      'Frontend/ is a legacy folder. Deploy the repository root so index.html and _worker.js are used.',
      {
        status: 410,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      }
    );
  },
};
