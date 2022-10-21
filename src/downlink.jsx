import axios from 'axios';
import { useEffect, useRef } from 'react';
import {
  Form,
  json,
  Link,
  Outlet,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useRouteError,
} from 'react-router-dom';

const http = axios.create({
  baseURL: 'https://api.alldebrid.com/v4/',
  headers: {
    Authorization: `Bearer ${import.meta.env.VITE_APP_ALLDEBRID_API_KEY}`,
  },
});

const gb = (bytes) => {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} gb`;
};

const Layout = () => {
  return (
    <main className="relative top-1/4 flex flex-col items-center gap-4 p-4">
      <h1 className="font-serif text-2xl font-semibold">
        <Link to="/">downlink</Link>
      </h1>

      <Outlet />
    </main>
  );
};

const ErrorBoundary = () => {
  const error = useRouteError();

  return (
    <section className="flex h-full w-full flex-col items-center justify-center p-8 text-center font-serif">
      <h2 className="font-2xl font-semibold">Oops!!!</h2>
      <p className="text-gray-500">{error.message}</p>
    </section>
  );
};

const Download = ({ name, size, url, status, time }) => {
  let description = 'Still processing';
  description = status === 2 ? 'Download link is available' : description;

  return (
    <div className="flex w-full items-center justify-between gap-2 rounded-md border p-4 font-serif lowercase shadow-md">
      <div className="w-[85%]">
        <p className="truncate">{name}</p>
        {size ? <p className="text-gray-500">{gb(size)}</p> : null}
        {status ? (
          <p className="text-gray-500">
            status: <span className="text-gray-700">{description}</span>
          </p>
        ) : null}
        {time ? (
          <p className="text-gray-500">time left: {time} seconds</p>
        ) : null}
      </div>
      {url ? (
        <a target={'_blank'} href={url}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-6 w-6"
          >
            <path
              fillRule="evenodd"
              d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z"
              clipRule="evenodd"
            />
          </svg>
        </a>
      ) : null}
    </div>
  );
};

const Downlink = () => {
  const linkRef = useRef();
  const download = useActionData();
  const { id, name, size, url, streams, delayed } = download || {};

  useEffect(() => {
    if (download) {
      linkRef.current.value = '';
    } else {
      linkRef.current.focus();
    }
  }, [download]);

  return (
    <section className="flex w-full flex-col gap-2">
      <Form method="post">
        <textarea
          placeholder="enter magnet uri"
          className="w-full resize-none rounded-md border border-black p-2 text-center outline-black"
          rows={4}
          name="link"
          ref={linkRef}
          required
        />

        <button
          type="submit"
          className="h-8 w-full rounded bg-black font-serif text-white"
        >
          get download link
        </button>
      </Form>
      {url ? <Download {...download} /> : null}
      {streams ? (
        <div className="rounded-md border p-2 font-serif">
          <h2 className="mb-4 font-semibold">Available Streams</h2>
          {streams.map(({ id: stream, type, filesize, quality }) => {
            return (
              <Link to={`/streams/${id}/${encodeURI(stream)}`} key={stream}>
                <p className="font-serif font-semibold">
                  <span>{type}</span>({quality})
                </p>
                <p className="text-gray-500">{gb(filesize)}</p>
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};

const downloadAction = async ({ request }) => {
  let { link } = Object.fromEntries(await request.formData());
  link = encodeURI(link);

  let { data: response } = await http.get('link/unlock', {
    params: {
      agent: import.meta.env.VITE_APP_ALLDEBRID_AGENT,
      link,
    },
  });

  let { status, error } = response;
  if (status === 'error') {
    const { message } = error;
    return json(
      {
        message,
      },
      {
        status: 400,
      }
    );
  } else {
    const {
      data: { id, filename: name, filesize: size, link: url, delayed, streams },
    } = response;

    if (url) {
      // Instant link not available.Try uploading torrent
      if (size === 0 && link.includes('magnet:?xt=')) {
        ({ data: response } = await http.get('magnet/upload', {
          params: {
            agent: import.meta.env.VITE_APP_ALLDEBRID_AGENT,
            'magnets[]': link,
          },
        }));
        ({ status, error } = response);

        if (status === 'error') {
          const { message } = error;
          return json(
            {
              message,
            },
            {
              status: 400,
            }
          );
        } else {
          const {
            data: { magnets },
          } = response;

          const [magnet] = magnets;
          const { id, size } = magnet;

          return redirect(`/torrents/${id}`);
        }
      } else {
        return json({ id, name, size, url });
      }
    } else if (delayed) {
      return json({ id, name, size, url, delayed });
    } else if (streams && streams.length) {
      return json({ id, name, size, url, streams });
    }

    return json(
      {
        message: 'Not supported',
      },
      {
        status: 400,
      }
    );
  }
};

const torrentLoader = async ({ params }) => {
  const { id } = params;
  const { data: response } = await http.get('magnet/status', {
    params: {
      agent: import.meta.env.VITE_APP_ALLDEBRID_AGENT,
      id,
    },
  });

  const {
    data: { magnets: magnet },
  } = response;

  return magnet;
};

const Torrent = () => {
  const fetcher = useFetcher();
  const data = useLoaderData();
  const torrentFetcher = useFetcher();

  useEffect(() => {
    const startTimer = fetcher.state === 'idle' && data.status !== 'Ready';
    let timer;

    if (startTimer) {
      timer = setTimeout(() => {
        fetcher.load(`/torrents/${data.id}`);
      }, 10 * 1000);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [fetcher, data]);

  const magnet = fetcher.data || data;

  const { filename: name, size, downloaded, links, status } = magnet;
  const done = status === 'Ready';
  let link;

  if (done) {
    [link] = links;
    ({ link } = link);
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <section className="w-full space-y-1 rounded-md border p-2 shadow-md">
        <p className="truncate font-serif lowercase">{name}</p>
        <p className="font-serif text-gray-500">{`Downloaded ${gb(
          downloaded
        )} of ${gb(size)}`}</p>
        <p className="lowercase">
          <span className="text-gray-500">Status:</span> {status}
        </p>
        {done ? (
          <torrentFetcher.Form
            method="post"
            action="/?index"
            className="flex flex-col"
          >
            <textarea
              placeholder="enter magnet uri"
              className="w-full resize-none rounded-md border border-black p-2 text-center outline-black"
              rows={4}
              name="link"
              required
              value={link}
              hidden
            />

            <button
              type="submit"
              className="h-8 w-full rounded bg-black text-white"
            >
              get download link
            </button>
          </torrentFetcher.Form>
        ) : null}
      </section>
      {torrentFetcher.data ? <Download {...torrentFetcher.data} /> : null}
    </div>
  );
};

const streamLoader = async ({ params }) => {
  const { id, stream } = params;
  const { data: response } = await http.get('link/streaming', {
    params: {
      agent: import.meta.env.VITE_APP_ALLDEBRID_AGENT,
      id,
      stream,
    },
  });

  let { status, error } = response;
  if (status === 'error') {
    const { message } = error;
    return json(
      {
        message,
      },
      {
        status: 400,
      }
    );
  } else {
    const {
      data: { filename: name, filesize: size, link: url, delayed },
    } = response;

    if (delayed) {
      return redirect(`/delayed/${delayed}`);
    }

    return json({
      name,
      size,
      url,
    });
  }
};

const Stream = () => {
  const data = useLoaderData();
  return <Download {...data} />;
};

const delayedLoader = async ({ params }) => {
  const { id } = params;

  const { data: response } = await http.get('link/delayed', {
    params: {
      agent: import.meta.env.VITE_APP_ALLDEBRID_AGENT,
      id,
    },
  });

  let { status, error } = response;
  if (status === 'error') {
    const { message } = error;
    return json(
      {
        message,
      },
      {
        status: 400,
      }
    );
  } else {
    let {
      data: { status, time_left: time, link: url },
    } = response;

    if (status === 3) {
      return json(
        {
          message: 'Could not generate download link',
        },
        {
          status: 400,
        }
      );
    }

    status = status === 0 ? 1 : status;

    const name = url ? decodeURI(url.split('/').pop()) : undefined;
    return json({ id, status, time, url, name });
  }
};

const Delayed = () => {
  const data = useLoaderData();
  const delayedFetcher = useFetcher();

  useEffect(() => {
    const startTimer = delayedFetcher.state === 'idle' && data.status === 1;
    let timer;

    if (startTimer) {
      timer = setTimeout(() => {
        delayedFetcher.load(`/delayed/${data.id}`);
      }, 5 * 1000);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [delayedFetcher, data]);

  const download = delayedFetcher.data || data;

  return <Download {...download} />;
};

export {
  Layout,
  ErrorBoundary,
  Downlink,
  downloadAction,
  torrentLoader,
  Torrent,
  streamLoader,
  Stream,
  delayedLoader,
  Delayed,
};
