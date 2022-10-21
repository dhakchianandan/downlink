import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import {
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
} from './downlink';

import './index.css';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        element: <Downlink />,
        action: downloadAction,
      },
      {
        path: 'torrents/:id',
        loader: torrentLoader,
        element: <Torrent />,
      },
      {
        path: 'streams/:id/:stream',
        loader: streamLoader,
        element: <Stream />,
      },
      {
        path: 'delayed/:id',
        loader: delayedLoader,
        element: <Delayed />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
