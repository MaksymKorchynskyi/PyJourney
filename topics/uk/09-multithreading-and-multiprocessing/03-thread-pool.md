# Пул потоків

Створювати `Thread` вручну для кожної дрібної задачі нормально, коли задач кілька, але це не масштабується: створення потоків коштує часу й пам'яті, ніщо не обмежує їхню кількість, а результати та винятки незручно збирати. **Пул потоків** (thread pool) розв'язує всі три проблеми. У Python це `concurrent.futures.ThreadPoolExecutor`.

## Що ви дізнаєтесь

- Що таке пул потоків і чим він кращий за ручне створення потоків
- Як запускати задачі через `ThreadPoolExecutor.submit()` і `map()`
- Що таке `Future` і як отримати з нього результат, виняток і стан
- Як обробляти результати в міру готовності за допомогою `as_completed()` і `wait()`
- Як у пулі працюють винятки, тайм-аути, завершення роботи й скасування
- Як обрати кількість робочих потоків

## Навіщо пул потоків?

З «голим» `threading.Thread` ви запускаєте новий потік на кожну задачу. Це має три ціни:

- **Витрати на створення.** Кожен потік створює ОС, а потім його знищують. Для тисяч коротких задач ці витрати накопичуються.
- **Відсутність обмеження.** 10 000 потоків для 10 000 URL можуть вичерпати пам'ять, упертися в ліміти ОС або перевантажити сервер, до якого ви звертаєтеся.
- **Ручний облік.** Потоки відкидають повернені значення й не передають винятки викликачу, тож збирати їх доводиться самостійно.

Пул потоків створює фіксовану кількість **робочих потоків** (workers) і **використовує їх повторно**. Ви кладете задачі в чергу, вільні робочі потоки забирають їх по одній, а кожна надіслана задача повертає вам об'єкт `Future`, у якому згодом опиниться її результат або виняток.

```text
 ваш код                     пул потоків (max_workers=3)
                         +-------------------------------+
 submit(task) ---------> |  черга задач: [t4][t5][t6] ...|
   повертає Future       |        |      |      |        |
                         |    worker_0 worker_1 worker_2 |
                         +--------|------|------|--------+
                                  v      v      v
                         кожен Future отримує результат або виняток
```

## `ThreadPoolExecutor` коротко

`ThreadPoolExecutor` міститься в модулі `concurrent.futures`. Це підклас абстрактного класу `Executor`, який визначає три методи:

| Метод | Що робить |
|---|---|
| `submit(fn, *args, **kwargs)` | Планує один виклик `fn(*args, **kwargs)` і одразу повертає `Future` |
| `map(fn, *iterables, timeout=None)` | Викликає `fn` для кожного елемента й повертає ітератор результатів **у порядку вхідних даних** |
| `shutdown(wait=True, cancel_futures=False)` | Припиняє приймати нові задачі й звільняє робочі потоки |

Найкорисніші параметри конструктора:

| Параметр | Значення |
|---|---|
| `max_workers` | Максимальна кількість робочих потоків. Типово `min(32, os.process_cpu_count() + 4)` (Python 3.13+; раніші версії використовують `os.cpu_count()`) |
| `thread_name_prefix` | Префікс імен робочих потоків, наприклад `"worker"` дає `worker_0`, `worker_1`, ... |
| `initializer`, `initargs` | Функція (та її аргументи), яка виконується один раз у кожному робочому потоці під час його старту |

Робочі потоки створюються ліниво, лише коли надходять задачі, і не більше ніж `max_workers`.

Коли роботу завершено, потоки пулу треба звільнити. Найпростіше — блок `with`: вихід із нього викликає `shutdown(wait=True)`, який **чекає завершення всіх надісланих задач**.

## Об'єкти `Future`

`Future` представляє **майбутній результат** виклику, який, можливо, ще не завершився. Основні методи:

| Метод | Що робить |
|---|---|
| `result(timeout=None)` | Чекає на виклик і повертає його значення або **повторно піднімає** його виняток |
| `exception(timeout=None)` | Чекає на виклик і повертає об'єкт винятку або `None` |
| `done()` | `True`, якщо виклик завершився або його скасовано |
| `running()` | `True`, поки робочий потік його виконує |
| `cancel()` | Пробує скасувати. Спрацьовує, лише якщо виклик ще не почався |
| `cancelled()` | `True`, якщо виклик скасовано |
| `add_done_callback(fn)` | Викликає `fn(future)`, щойно `Future` завершиться |

```python
from concurrent.futures import ThreadPoolExecutor
from time import sleep


def slow_double(x):
    sleep(0.2)
    return x * 2


with ThreadPoolExecutor(max_workers=1) as executor:
    future = executor.submit(slow_double, 21)
    print(future)
    print("done?", future.done())
    print("result:", future.result())  # блокує, доки результат не буде готовий
    print("done?", future.done())
    print(future)
```

Результат (адреса щоразу інша):

```text
<Future at 0x10529d010 state=running>
done? False
result: 42
done? True
<Future at 0x10529d010 state=finished returned int>
```

`submit()` одразу повернув `Future` у стані `running`. `result()` заблокував головний потік приблизно на 0,2 секунди, доки значення не стало готовим.

## Послідовна версія для порівняння

Ось задача, що імітує введення-виведення пів секундним сном, і два її виклики поспіль:

```python
from time import perf_counter, sleep


def task(task_id):
    print(f"Starting the task {task_id}...")
    sleep(0.5)
    return f"Done with task {task_id}"


start = perf_counter()

print(task(1))
print(task(2))

finish = perf_counter()
print(f"It took {finish - start:.2f} second(s) to finish.")
```

Результат (час може трохи відрізнятися):

```text
Starting the task 1...
Done with task 1
Starting the task 2...
Done with task 2
It took 1.01 second(s) to finish.
```

На відміну від цільової функції звичайного `Thread`, ця `task()` **повертає** значення. Пул дає змогу зберегти цей зручний стиль.

## Запуск задач через `submit()`

```python
from concurrent.futures import ThreadPoolExecutor
from time import perf_counter, sleep


def task(task_id):
    print(f"Starting the task {task_id}...")
    sleep(0.5)
    return f"Done with task {task_id}"


start = perf_counter()

with ThreadPoolExecutor() as executor:
    f1 = executor.submit(task, 1)
    f2 = executor.submit(task, 2)

    print(f1.result())
    print(f2.result())

finish = perf_counter()
print(f"It took {finish - start:.2f} second(s) to finish.")
```

Результат (час може трохи відрізнятися):

```text
Starting the task 1...
Starting the task 2...
Done with task 1
Done with task 2
It took 0.51 second(s) to finish.
```

Як це працює:

1. `with ThreadPoolExecutor() as executor:` створює пул і гарантує, що наприкінці блоку його роботу буде завершено.
2. `executor.submit(task, 1)` планує `task(1)` і одразу повертає `Future`. Аргументи передають після функції, **а не** як виклик: `submit(task, 1)`, а не `submit(task(1))`.
3. `f1.result()` чекає завершення `task(1)` і повертає її значення. Обидві задачі вже виконувалися, тож очікування перекрилися, і вся програма тривала близько пів секунди.

## Запуск задач через `map()`

`executor.map(fn, iterable)` — це конкурентна версія вбудованої `map()`:

```python
from concurrent.futures import ThreadPoolExecutor
from time import perf_counter, sleep


def task(task_id):
    print(f"Starting the task {task_id}...")
    sleep(0.5)
    return f"Done with task {task_id}"


start = perf_counter()

with ThreadPoolExecutor() as executor:
    results = executor.map(task, [1, 2])
    for result in results:
        print(result)

finish = perf_counter()
print(f"It took {finish - start:.2f} second(s) to finish.")
```

Результат (час може трохи відрізнятися):

```text
Starting the task 1...
Starting the task 2...
Done with task 1
Done with task 2
It took 0.51 second(s) to finish.
```

Що треба знати про `map()`:

- Усі задачі надсилаються одразу, але повернений **ітератор** видає результати **в порядку вхідних даних**. Якщо перша задача найповільніша, ви чекаєте на неї, навіть коли наступні результати вже готові.
- Якщо задача згенерувала виняток, його буде повторно піднято **в момент, коли ітератор дійде до цього результату**.
- `timeout=` відраховується від виклику `map()`. Якщо наступний результат до цього часу не готовий, ітерація генерує `TimeoutError`.
- Кілька ітерованих об'єктів працюють так само, як у вбудованій `map()`: `executor.map(pow, [2, 3], [10, 2])` обчислює `pow(2, 10)` і `pow(3, 2)`.
- У Python 3.14 з'явився параметр `buffersize=`. Він обмежує, скільки задач надсилається наперед відносно вже спожитих результатів, що допомагає з дуже довгими чи нескінченними вхідними ітерованими об'єктами.

### Робочі потоки використовуються повторно

Пул із двома робочими потоками виконує шість задач на тих самих двох потоках:

```python
import threading
from concurrent.futures import ThreadPoolExecutor
from time import sleep


def task(task_id):
    sleep(0.1)
    return f"task {task_id} ran in {threading.current_thread().name}"


with ThreadPoolExecutor(max_workers=2, thread_name_prefix="worker") as executor:
    for line in executor.map(task, range(1, 7)):
        print(line)
```

Результат (який потік отримає яку задачу, може змінюватися):

```text
task 1 ran in worker_0
task 2 ran in worker_1
task 3 ran in worker_0
task 4 ran in worker_1
task 5 ran in worker_0
task 6 ran in worker_1
```

З `max_workers=2` одночасно виконуються щонайбільше дві задачі, і шість задач тривають близько 0,3 секунди. Так пул **обмежує конкурентність**, наприклад щоб не перевантажувати вебсервер.

## Результати в міру готовності: `as_completed()`

`as_completed(futures)` видає об'єкти `Future` **у порядку їх завершення**, а не надсилання. Щоб знати, який результат до чого належить, зазвичай використовують словник, що зіставляє кожен `Future` з його вхідними даними:

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import perf_counter, sleep


def fetch(seconds):
    sleep(seconds)
    return f"{seconds} s of work"


jobs = {"slow": 0.3, "fast": 0.1, "medium": 0.2}
start = perf_counter()

with ThreadPoolExecutor() as executor:
    # зіставляємо кожен Future з назвою задачі
    future_to_name = {executor.submit(fetch, sec): name for name, sec in jobs.items()}

    for future in as_completed(future_to_name):
        name = future_to_name[future]
        print(f"{name:<7} {future.result()}, finished at {perf_counter() - start:.1f} s")
```

Результат (час може трохи відрізнятися):

```text
fast    0.1 s of work, finished at 0.1 s
medium  0.2 s of work, finished at 0.2 s
slow    0.3 s of work, finished at 0.3 s
```

Кожен результат обробляється, щойно він готовий. З `map()` ви спершу отримали б `slow` через 0,3 секунди і лише потім два інші.

Для тоншого керування є `wait(futures, timeout=None, return_when=...)`. Вона повертає дві множини `(done, not_done)`. `return_when` може бути `ALL_COMPLETED` (типово), `FIRST_COMPLETED` або `FIRST_EXCEPTION`:

```python
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from time import sleep


def job(seconds):
    sleep(seconds)
    return seconds


with ThreadPoolExecutor() as executor:
    futures = [executor.submit(job, s) for s in (0.3, 0.1, 0.2)]
    done, not_done = wait(futures, return_when=FIRST_COMPLETED)
    print("first finished:", [f.result() for f in done])
    print("still running:", len(not_done))
```

Результат:

```text
first finished: [0.1]
still running: 2
```

## Обробка винятків

Виняток усередині задачі не руйнує робочий потік і не виводиться на екран. Він зберігається у `Future`. `result()` повторно піднімає його в потоці, що викликає метод, а `exception()` повертає його, не піднімаючи:

```python
from concurrent.futures import ThreadPoolExecutor


def parse_price(text):
    return float(text)


with ThreadPoolExecutor() as executor:
    good = executor.submit(parse_price, "19.99")
    bad = executor.submit(parse_price, "free")

    print(good.result())
    print(repr(bad.exception()))  # об'єкт винятку, без піднімання

    try:
        bad.result()               # тут виняток піднімається повторно
    except ValueError as exc:
        print("caught:", exc)
```

Результат:

```text
19.99
ValueError("could not convert string to float: 'free'")
caught: could not convert string to float: 'free'
```

З `map()` виняток з'являється під час ітерації, і решта результатів для цього циклу втрачається:

```python
from concurrent.futures import ThreadPoolExecutor


def parse_price(text):
    return float(text)


with ThreadPoolExecutor() as executor:
    results = executor.map(parse_price, ["1.5", "2.5", "free", "4.0"])
    try:
        for value in results:
            print(value)
    except ValueError as exc:
        print("stopped:", exc)
```

Результат:

```text
1.5
2.5
stopped: could not convert string to float: 'free'
```

Якщо потрібні всі результати, зокрема невдалі, використовуйте `submit()` і перевіряйте кожен `Future` (див. вправу 2).

## Завершення роботи та скасування

`shutdown(wait=True)` (або вихід із блоку `with`) чекає, доки завершаться всі надіслані задачі. Починаючи з Python 3.9, `cancel_futures=True` скасовує задачі, які **ще не почалися**. Задачі, що вже виконуються, завжди доходять до кінця, бо потік не можна зупинити ззовні.

```python
from concurrent.futures import ThreadPoolExecutor
from time import sleep


def job(n):
    sleep(0.1)
    return n


executor = ThreadPoolExecutor(max_workers=2)
futures = [executor.submit(job, n) for n in range(6)]
executor.shutdown(wait=True, cancel_futures=True)

print([f.cancelled() for f in futures])
print([f.result() for f in futures if not f.cancelled()])
```

Результат:

```text
[False, False, True, True, True, True]
[0, 1]
```

Два робочі потоки вже виконували задачі 0 і 1. Задачі 2–5 ще чекали в черзі, тому їх скасовано. Після `shutdown()` виклик `submit()` генерує `RuntimeError`.

## Практичний приклад: завантаження зображень

Програма нижче паралельно завантажує кілька зображень і зберігає їх у теку. Щоб її можна було запустити без мережі, `fake_urlopen()` замінює справжнє завантаження: чекає 0,3 секунди й повертає трохи байтів.

```python
import os
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from functools import partial
from pathlib import Path

URLS = [
    "https://example.com/images/python_bivittatus.jpg",
    "https://example.com/images/python_regius.jpg",
    "https://example.com/images/carpet_python.jpg",
    "https://example.com/images/rock_python.jpg",
    "https://example.com/images/wilpattu_python.jpg",
]


def fake_urlopen(url):
    """Замінник справжнього завантаження: чекає, як мережевий виклик, і повертає байти."""
    time.sleep(0.3)
    return f"<image data from {url}>".encode()


def download_image(url, folder):
    image_data = fake_urlopen(url)
    if not image_data:
        raise ValueError(f"could not download the image from {url}")

    path = folder / os.path.basename(url)
    path.write_bytes(image_data)
    return f"{path.name} was downloaded ({len(image_data)} bytes)"


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        download = partial(download_image, folder=Path(tmp))
        start = time.perf_counter()

        with ThreadPoolExecutor(max_workers=5) as executor:
            for message in executor.map(download, URLS):
                print(message)

        finish = time.perf_counter()
        print(f"It took {finish - start:.2f} second(s) to finish.")
```

Результат (час може трохи відрізнятися):

```text
python_bivittatus.jpg was downloaded (66 bytes)
python_regius.jpg was downloaded (62 bytes)
carpet_python.jpg was downloaded (62 bytes)
rock_python.jpg was downloaded (60 bytes)
wilpattu_python.jpg was downloaded (64 bytes)
It took 0.31 second(s) to finish.
```

П'ять «завантажень» по 0,3 секунди разом тривали близько 0,3 секунди. Кілька зауважень щодо побудови:

- `functools.partial(download_image, folder=...)` фіксує аргумент `folder`, тож `map()` має передати лише URL.
- Робоча функція **повертає** повідомлення, а не друкує його. Друкує головний потік, тому виведення не перемішується й іде в порядку вхідних даних.
- Цикл по `executor.map(...)` **споживає результати**. Саме завдяки цьому виняток з будь-якого завантаження стане помітним. Виклик `executor.map(download, URLS)` без читання результатів приховав би всі помилки (див. «Типові помилки»).

Щоб завантажувати насправді, замініть `fake_urlopen` на функцію на основі `urllib.request` (потрібен доступ до мережі):

```python
from urllib.request import urlopen


def real_urlopen(url):
    with urlopen(url, timeout=10) as response:
        return response.read()
```

Завжди задавайте `timeout` для мережевих викликів у пулі. Запит, що зависне назавжди, назавжди заблокує свій робочий потік.

## Як обрати `max_workers`

- Для **I/O-bound** роботи правильне число залежить від іншого боку: скільки з'єднань приймає сервер чи база даних, які обмеження частоти запитів, яка ширина каналу. Типове значення `min(32, CPUs + 4)` — розумний початок. Набагато більше рідко допомагає і може призвести до того, що вас обмежать.
- Для **CPU-bound** роботи на чистому Python пул потоків у стандартному CPython не допоможе через GIL. Використовуйте `ProcessPoolExecutor` (далі в цьому розділі) або збірку CPython без GIL (необов'язкова з 3.13, офіційно підтримувана з 3.14).
- Пул не робить спільні дані безпечними. Якщо задачі змінюють той самий об'єкт, захистіть його блокуванням `Lock` (наступна тема) або, краще, повертайте значення й об'єднуйте їх у головному потоці.

## Типові помилки

- **Ігнорувати результати `map()`.** Винятки зберігаються в об'єктах `Future`, тож якщо результати ніхто не читає, помилки тихо зникають:

  ```python
  from concurrent.futures import ThreadPoolExecutor


  def save(name):
      if name == "b":
          raise OSError("disk full")
      print("saved", name)


  with ThreadPoolExecutor() as executor:
      executor.map(save, ["a", "b", "c"])  # результати ніхто не читає

  print("finished, and no error was reported")
  ```

  Результат (порядок перших двох рядків може змінюватися):

  ```text
  saved a
  saved c
  finished, and no error was reported
  ```

  Завжди проходьте циклом по результатах `map()` або викликайте `result()` для кожного `Future`.
- **Викликати `result()` одразу після кожного `submit()`.** `executor.submit(task, n).result()` у циклі чекає на кожну задачу, перш ніж надіслати наступну, тож нічого не виконується конкурентно. Спершу надішліть усе, потім збирайте.
- **Писати `submit(task(1))`.** Так `task(1)` виконується в поточному потоці, а в пул потрапляє її результат. Пишіть `submit(task, 1)`.
- **Чекати, що `result(timeout=...)` зупинить задачу.** Тайм-аут зупиняє лише *очікування*. Задача виконується далі, і вихід із блоку `with` однаково чекає на неї.
- **Чекати всередині задачі на іншу задачу того самого пулу.** Якщо всі робочі потоки чекають на задачі, що досі стоять у черзі, виконати їх нікому, і програма зависає у взаємному блокуванні (deadlock).
- **Використовувати пул потоків для CPU-bound коду на Python** у стандартному CPython. Беріть пул процесів.
- **Забути завершити роботу пулу**, якщо ви не використовуєте `with`. Викличте `executor.shutdown()` самі, бажано в блоці `finally`.

## Підсумок

- Пул потоків тримає фіксований набір робочих потоків для повторного використання й чергу задач. У Python це `concurrent.futures.ThreadPoolExecutor`.
- `submit(fn, *args)` планує один виклик і повертає `Future`. `map(fn, iterable)` планує багато викликів і видає результати в порядку вхідних даних.
- `Future` зберігає майбутній результат: `result()` повертає його або повторно піднімає виняток, `exception()` повертає виняток, `done()` і `cancel()` показують стан і керують ним.
- `as_completed()` видає об'єкти `Future` у порядку завершення, `wait()` чекає на всі, на перший або на перший невдалий.
- Використовуйте виконавця (executor) у блоці `with`. На виході він чекає на всі задачі. `shutdown(cancel_futures=True)` відкидає задачі, що ще не почалися.
- `max_workers` обмежує конкурентність. Типове значення — `min(32, os.process_cpu_count() + 4)`.
- Пули потоків підходять для I/O-bound роботи. Завжди споживайте результати, щоб винятки не губилися.

## Практика

### Вправа 1: Від циклу до `map()`

Функція нижче перевіряє статус сторінки. Перевірте п'ять URL конкурентно через `executor.map()`, виведіть кожен URL з його статусом у початковому порядку, а також загальний час (близько 0,2 секунди замість 1).

```python
from time import sleep


def check_status(url):
    sleep(0.2)  # імітуємо HTTP-запит
    return url, 200


urls = [f"https://example.com/page{i}" for i in range(1, 6)]
```

### Вправа 2: Зберіть успіхи й невдачі

Напишіть `to_int(text)`, яка спить 0,05 секунди й повертає `int(text)`. Перетворіть `["10", "x", "25", "3.5", "-4"]` за допомогою `submit()` і `as_completed()`. Зберіть успішні перетворення в словник `ok` (`текст -> число`), а невдалі — у словник `errors` (`текст -> назва класу винятку`). Виведіть обидва словники, відсортовані за ключем.

### Вправа 3: Тайм-аути

Три сервіси відповідають через 0,05, 0,1 і 0,5 секунди. Викличте їх у пулі й чекайте на кожен результат через `result(timeout=0.2)`. Виведіть `"<name>: OK"` для відповідей і `"<name>: timed out"` для тайм-аутів. Потім виведіть, коли програма вийшла з блоку `with`, і поясніть цей час.

```python
services = {"auth": 0.05, "billing": 0.1, "reports": 0.5}
```

### Вправа 4: Одне з'єднання на робочий потік

Відкрити з'єднання з базою даних дорого, тому кожен робочий потік має відкрити рівно одне й використовувати його повторно. Застосуйте `ThreadPoolExecutor(max_workers=3, initializer=...)` і `threading.local()`, щоб кожен робочий потік мав власне уявне з'єднання (рядок з ім'ям потоку). Виконайте 9 запитів (кожен спить 0,1 секунди й повідомляє, яке з'єднання використав) і покажіть, що відкрито лише 3 з'єднання.

## Розв'язки

### Вправа 1

```python
from concurrent.futures import ThreadPoolExecutor
from time import perf_counter, sleep


def check_status(url):
    sleep(0.2)  # імітуємо HTTP-запит
    return url, 200


urls = [f"https://example.com/page{i}" for i in range(1, 6)]

start = perf_counter()
with ThreadPoolExecutor(max_workers=5) as executor:
    for url, status in executor.map(check_status, urls):
        print(url, status)
print(f"It took {perf_counter() - start:.2f} s")
```

Результат (час може трохи відрізнятися):

```text
https://example.com/page1 200
https://example.com/page2 200
https://example.com/page3 200
https://example.com/page4 200
https://example.com/page5 200
It took 0.21 s
```

### Вправа 2

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
from time import sleep


def to_int(text):
    sleep(0.05)
    return int(text)


inputs = ["10", "x", "25", "3.5", "-4"]
ok = {}
errors = {}

with ThreadPoolExecutor() as executor:
    future_to_text = {executor.submit(to_int, text): text for text in inputs}
    for future in as_completed(future_to_text):
        text = future_to_text[future]
        error = future.exception()
        if error is None:
            ok[text] = future.result()
        else:
            errors[text] = type(error).__name__

print("ok:", dict(sorted(ok.items())))
print("errors:", dict(sorted(errors.items())))
```

Результат:

```text
ok: {'-4': -4, '10': 10, '25': 25}
errors: {'3.5': 'ValueError', 'x': 'ValueError'}
```

`future.exception()` дає змогу перевірити помилку без блоку `try`. У `ok` і `errors` пише лише головний потік, тож блокування не потрібне. Сортування робить виведення незалежним від порядку завершення. Зверніть увагу: `"-4"` стоїть перед `"10"`, бо ключі — рядки.

### Вправа 3

```python
from concurrent.futures import ThreadPoolExecutor
from time import perf_counter, sleep


def call_service(name, delay):
    sleep(delay)
    return f"{name}: OK"


services = {"auth": 0.05, "billing": 0.1, "reports": 0.5}

start = perf_counter()
with ThreadPoolExecutor() as executor:
    futures = {
        name: executor.submit(call_service, name, delay)
        for name, delay in services.items()
    }
    for name, future in futures.items():
        try:
            print(future.result(timeout=0.2))
        except TimeoutError:
            print(f"{name}: timed out at {perf_counter() - start:.1f} s")

print(f"Left the with block at {perf_counter() - start:.1f} s")
```

Результат (час може трохи відрізнятися):

```text
auth: OK
billing: OK
reports: timed out at 0.3 s
Left the with block at 0.5 s
```

- Тайм-аут відраховується від моменту виклику `result()`, а не від `submit()`. Очікування `reports` почалося приблизно на 0,1 секунді, тож тайм-аут настав приблизно на 0,3.
- Тайм-аут не зупинив задачу. Вихід із блоку `with` чекав, доки `reports` не завершився на 0,5 секунді.
- Починаючи з Python 3.11, `concurrent.futures.TimeoutError` — це вбудований `TimeoutError`, тож його можна перехоплювати напряму.

### Вправа 4

```python
import threading
from concurrent.futures import ThreadPoolExecutor
from time import sleep

local = threading.local()  # кожен потік бачить власні атрибути
opened = []


def open_connection():
    # виконується один раз у кожному робочому потоці перед його першою задачею
    local.conn = f"connection<{threading.current_thread().name}>"
    opened.append(local.conn)


def query(n):
    sleep(0.1)  # імітуємо запит до бази даних
    return f"query {n} used {local.conn}"


with ThreadPoolExecutor(
    max_workers=3, thread_name_prefix="db", initializer=open_connection
) as executor:
    results = list(executor.map(query, range(1, 10)))

for line in results:
    print(line)
print("connections opened:", sorted(opened))
```

Результат (який запит використає яке з'єднання, може змінюватися):

```text
query 1 used connection<db_0>
query 2 used connection<db_1>
query 3 used connection<db_2>
query 4 used connection<db_0>
query 5 used connection<db_1>
query 6 used connection<db_2>
query 7 used connection<db_2>
query 8 used connection<db_0>
query 9 used connection<db_1>
connections opened: ['connection<db_0>', 'connection<db_1>', 'connection<db_2>']
```

`threading.local()` створює об'єкт, атрибути якого окремі для кожного потоку: `local.conn`, встановлений у `db_0`, невидимий у `db_1`. Ініціалізатор виконується один раз на робочий потік, тож 9 запитів ділять між собою 3 з'єднання. `list.append()` — одна потокобезпечна операція, тому `opened` тут не потребує блокування.

---

*Джерело: [pythontutorial.net — Python ThreadPoolExecutor](https://www.pythontutorial.net/advanced-python/python-threadpoolexecutor/). Адаптовано й доповнено для PyJourney.*
