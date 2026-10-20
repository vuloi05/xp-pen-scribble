using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Windows.Forms;

class InkPadLauncher
{
    private static string distDir;

    [STAThread]
    static void Main()
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        distDir = Path.Combine(baseDir, "dist");
        if (!Directory.Exists(distDir))
        {
            MessageBox.Show("Không tìm thấy thư mục dist. Vui lòng chạy npm run build trước.", "InkPad Scribble", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        int port = 51790;
        TcpListener listener = null;

        if (IsServerAlive(port))
        {
            LaunchAppWindow(port);
            return;
        }

        try
        {
            listener = new TcpListener(IPAddress.Loopback, port);
            listener.Start();
        }
        catch
        {
            listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            port = ((IPEndPoint)listener.LocalEndpoint).Port;
        }

        Thread serverThread = new Thread(() => ServeLoop(listener));
        serverThread.IsBackground = true;
        serverThread.Start();

        Process appProc = LaunchAppWindow(port);
        if (appProc != null)
        {
            try { appProc.WaitForExit(); } catch { }
        }
        else
        {
            Thread.Sleep(15000);
        }

        try { listener.Stop(); } catch { }
    }

    private static bool IsServerAlive(int port)
    {
        try
        {
            HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/");
            req.Timeout = 400;
            using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
            {
                return res.StatusCode == HttpStatusCode.OK;
            }
        }
        catch
        {
            return false;
        }
    }

    private static void ServeLoop(TcpListener listener)
    {
        while (true)
        {
            try
            {
                TcpClient client = listener.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem(_ => HandleClient(client));
            }
            catch
            {
                break;
            }
        }
    }

    private static void HandleClient(TcpClient client)
    {
        using (client)
        {
            try
            {
                client.ReceiveTimeout = 5000;
                client.SendTimeout = 5000;
                using (NetworkStream stream = client.GetStream())
                using (StreamReader reader = new StreamReader(stream, Encoding.ASCII, false, 1024, true))
                {
                    string requestLine = reader.ReadLine();
                    if (string.IsNullOrEmpty(requestLine)) return;

                    string line;
                    while (!string.IsNullOrEmpty(line = reader.ReadLine())) { }

                    string[] parts = requestLine.Split(' ');
                    if (parts.Length < 2) return;

                    string rawPath = Uri.UnescapeDataString(parts[1]);
                    int qIdx = rawPath.IndexOf('?');
                    if (qIdx >= 0) rawPath = rawPath.Substring(0, qIdx);
                    if (rawPath == "/" || string.IsNullOrEmpty(rawPath)) rawPath = "/index.html";

                    string relPath = rawPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                    string fullPath = Path.GetFullPath(Path.Combine(distDir, relPath));

                    if (!fullPath.StartsWith(Path.GetFullPath(distDir), StringComparison.OrdinalIgnoreCase) || !File.Exists(fullPath))
                    {
                        byte[] notFound = Encoding.UTF8.GetBytes("Not Found");
                        WriteHeader(stream, "404 Not Found", "text/plain; charset=utf-8", notFound.Length);
                        stream.Write(notFound, 0, notFound.Length);
                        return;
                    }

                    byte[] body = File.ReadAllBytes(fullPath);
                    string mime = GetMimeType(Path.GetExtension(fullPath));
                    WriteHeader(stream, "200 OK", mime, body.Length);
                    if (parts[0] != "HEAD")
                    {
                        stream.Write(body, 0, body.Length);
                    }
                }
            }
            catch { }
        }
    }

    private static void WriteHeader(Stream stream, string status, string contentType, int contentLength)
    {
        string header = "HTTP/1.1 " + status + "\r\n" +
                        "Content-Type: " + contentType + "\r\n" +
                        "Content-Length: " + contentLength + "\r\n" +
                        "Cache-Control: no-cache\r\n" +
                        "Connection: close\r\n\r\n";
        byte[] bytes = Encoding.ASCII.GetBytes(header);
        stream.Write(bytes, 0, bytes.Length);
    }

    private static string GetMimeType(string ext)
    {
        switch (ext.ToLowerInvariant())
        {
            case ".html": return "text/html; charset=utf-8";
            case ".js":
            case ".mjs": return "application/javascript; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".json": return "application/json; charset=utf-8";
            case ".svg": return "image/svg+xml";
            case ".png": return "image/png";
            case ".ico": return "image/x-icon";
            case ".ttf": return "font/ttf";
            case ".woff": return "font/woff";
            case ".woff2": return "font/woff2";
            default: return "application/octet-stream";
        }
    }

    private static Process LaunchAppWindow(int port)
    {
        string url = "http://127.0.0.1:" + port + "/";
        string[] browsers = new string[]
        {
            @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            @"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            @"C:\Program Files\Google\Chrome\Application\chrome.exe",
            @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
        };

        string browserExe = null;
        foreach (string b in browsers)
        {
            if (File.Exists(b)) { browserExe = b; break; }
        }

        if (browserExe != null)
        {
            string profileDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "InkPadScribble",
                "AppProfile"
            );
            Directory.CreateDirectory(profileDir);

            ProcessStartInfo psi = new ProcessStartInfo
            {
                FileName = browserExe,
                Arguments = "--app=" + url + " --user-data-dir=\"" + profileDir + "\" --window-size=1440,920 --no-first-run --no-default-browser-check",
                UseShellExecute = false
            };
            return Process.Start(psi);
        }

        Process.Start(new ProcessStartInfo { FileName = url, UseShellExecute = true });
        return null;
    }
}
