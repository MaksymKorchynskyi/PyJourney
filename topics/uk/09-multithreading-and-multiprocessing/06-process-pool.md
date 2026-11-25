# Пул процесів

Створювати `Process` на кожну задачу, як у темі «Багатопроцесність: модуль multiprocessing», швидко стає проблемою: кожен процес коштує нового інтерпретатора, ніщо не обмежує кількість одночасних процесів, а результати доводиться повертати вручну. **Пул процесів** (process pool) один раз запускає фіксовану кількість робочих процесів, повторно використовує їх для всіх задач і сам повертає вам результати та винятки. У Python це `concurrent.futures.ProcessPoolExecutor`.

## Що ви дізнаєтесь

- Чим пул процесів кращий за ручне створення процесів
- Що `ProcessPoolExecutor` має спільного з `ThreadPoolExecutor` і чим відрізняється
- Як запускати CPU-bound задачі через `submit()` і `map()` і чому важливий `chunksize`
- Як результати й винятки повертаються з робочих процесів
- Як налаштувати робочі процеси через `initializer` і що означає `BrokenProcessPool`
- Як завершити роботу пулу, скасувати задачі й зупинити робочі процеси, що зависли
- Коли брати пул процесів, пул потоків або `multiprocessing.Pool`

## Навіщо пул процесів?

Запуск процесу приблизно в сто разів дорожчий за запуск потоку (це вимірюється в темі «Процеси та потоки»). Створення окремого процесу на кожну задачу має три проблеми:

- **Витрати на запуск для кожної задачі.** Для тисяч коротких задач запуск інтерпретаторів триває довше за саму роботу.
- **Відсутність обмеження.** Процес на кожне зображення для 5000 зображень означає 5000 інтерпретаторів, що змагаються, скажімо, за 8 ядер, і купу пам'яті.
- **Ручна «сантехніка».** `Process` відкидає повернені значення й не передає винятки батьківському процесу, тож потрібні черги й перевірки кодів завершення.

Пул процесів розв'язує всі три проблеми. Він запускає фіксовану кількість **робочих процесів** (workers), типово по одному на процесор, і тримає їх живими. Кожна задача **серіалізується через pickle**, надсилається вільному робочому процесу й виконується там, а її результат (або виняток) так само серіалізується й повертається в `Future` у головному процесі.

```text
 головний процес                               робочі процеси
+---------------------------+                 +----------------------+
| submit(fn, x) -> Future   | задача (pickle) |  worker 1: fn(x)     |
|                           | --------------> |  worker 2: fn(y)     |
| future.result()  <--------+---------------- |  worker 3: вільний   |
|                           | результат       |  ... (max_workers)   |
+---------------------------+                 +----------------------+
```

## `ProcessPoolExecutor` коротко

`ProcessPoolExecutor`, як і `ThreadPoolExecutor`, — підклас `concurrent.futures.Executor`. Інтерфейс у них однаковий, тож усе з теми «Пул потоків» стосується й пулу процесів:

| Метод | Що робить |
|---|---|
| `submit(fn, *args, **kwargs)` | Планує один виклик і одразу повертає `Future` |
| `map(fn, *iterables, timeout=None, chunksize=1, buffersize=None)` | Викликає `fn` для кожного елемента й видає результати **в порядку вхідних даних** |
| `shutdown(wait=True, cancel_futures=False)` | Припиняє приймати задачі й звільняє робочі процеси. Блок `with` викликає його за вас |

Об'єкти `Future` теж ті самі. Два методи, якими користуються найчастіше:

- `result(timeout=None)` чекає на задачу й повертає її значення або **повторно піднімає** виняток, що виник у робочому процесі;
- `exception(timeout=None)` чекає й повертає об'єкт винятку або `None`, якщо задача завершилася успішно.

`done()`, `cancel()`, `as_completed()` і `wait()` працюють точнісінько так, як описано в темі «Пул потоків».

Параметри конструктора:

| Параметр | Значення |
|---|---|
| `max_workers` | Кількість робочих процесів. Типово `os.process_cpu_count()` (Python 3.13+; раніше `os.cpu_count()`). У Windows щонайбільше 61 |
| `mp_context` | Контекст `multiprocessing`, що задає спосіб запуску, наприклад `multiprocessing.get_context("spawn")` |
| `initializer`, `initargs` | Функція (та її аргументи), яка виконується один раз у кожному робочому процесі під час його старту |
| `max_tasks_per_child` | (Python 3.11+) Замінювати робочий процес новим після того, як він виконав стільки задач. Корисно проти витоків пам'яті в сторонньому коді |

> **Зверніть увагу:** під час перевірки на Python 3.14.0 у macOS пул із `max_tasks_per_child` більшим за 1 зависав, щойно робочий процес треба було замінити. Це вада CPython, а не вашого коду. Якщо вам потрібне перезапускання робочих процесів, перевірте його на своїй версії Python або скористайтеся `multiprocessing.Pool(maxtasksperchild=...)`.

Чим пул процесів відрізняється від пулу потоків:

- Задачі виконуються в **інших процесах**, тому функція, її аргументи й повернене значення мають **підтримувати pickle**.
- Код, що створює пул, має стояти під `if __name__ == "__main__":` з тієї самої причини, що й для `Process` (способи запуску пояснено в темі «Багатопроцесність: модуль multiprocessing»).
- Робочі процеси не мають спільної пам'яті ні з головним процесом, ні між собою.
- У Python 3.14 з'явилися `terminate_workers()` і `kill_workers()`: на відміну від потоків, робочі процеси можна зупинити ззовні.

## CPU-bound робота: потоки проти процесів

Ось CPU-bound функція, яку вісім разів виконано послідовно, у пулі потоків і в пулі процесів:

```python
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor


def sum_of_squares(n):
    return sum(i * i for i in range(n))


NUMBERS = [5_000_000] * 8


def run(executor_class):
    with executor_class(max_workers=8) as executor:
        return list(executor.map(sum_of_squares, NUMBERS))


if __name__ == "__main__":
    start = time.perf_counter()
    expected = [sum_of_squares(n) for n in NUMBERS]
    print(f"sequential:          {time.perf_counter() - start:.2f} s")

    for executor_class in (ThreadPoolExecutor, ProcessPoolExecutor):
        start = time.perf_counter()
        results = run(executor_class)
        elapsed = time.perf_counter() - start
        print(f"{executor_class.__name__:<20} {elapsed:.2f} s, same results: {results == expected}")
```

Результат (час може відрізнятися; стандартний CPython із GIL на 10-ядерній машині):

```text
sequential:          1.06 s
ThreadPoolExecutor   1.04 s, same results: True
ProcessPoolExecutor  0.33 s, same results: True
```

Пул потоків нічого не виграв: під GIL вісім потоків лише чергувалися. Пул процесів виконав задачі на восьми ядрах. Він виявився приблизно втричі, а не вісім разів, швидшим, бо запуск робочих процесів і передавання даних між процесами теж забирають час. Зверніть увагу: щоб перейти від одного пулу до іншого, довелося змінити **одне ім'я класу**. Саме в цьому сенс спільного інтерфейсу `Executor`.

## Надсилання задач і повторне використання робочих процесів

`submit()` одразу повертає `Future`. Пул зберігає свої робочі процеси й видає їм задачу за задачею:

```python
import os
import time
from concurrent.futures import ProcessPoolExecutor


def square(n):
    time.sleep(0.1)  # удаємо, що це справжня робота
    return n, n * n, os.getpid()


if __name__ == "__main__":
    print("main process PID:", os.getpid())
    with ProcessPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(square, n) for n in range(1, 7)]
        results = [f.result() for f in futures]

    for n, sq, pid in results:
        print(f"{n} squared is {sq:>2}, computed in PID {pid}")
    print("distinct worker PIDs:", len({pid for *_, pid in results}))
```

Результат (PID і те, який процес отримає яку задачу, змінюються):

```text
main process PID: 58386
1 squared is  1, computed in PID 58388
2 squared is  4, computed in PID 58389
3 squared is  9, computed in PID 58388
4 squared is 16, computed in PID 58389
5 squared is 25, computed in PID 58388
6 squared is 36, computed in PID 58389
distinct worker PIDs: 2
```

Шість задач, але запущено лише два процеси, і жоден із них не є головним. Результати повертаються в порядку списку `futures`, бо `f.result()` викликається для кожного `Future` по черзі. Щоб отримувати результати в порядку завершення, використовуйте `as_completed()` (див. вправу 2).

## `map()` і `chunksize`

У пулі процесів кожна задача мандрує між процесами: аргументи серіалізуються й надсилаються робочому процесу, а результат серіалізується й повертається. Для важких задач ці витрати непомітні. Для **дрібних** вони переважують усе інше. Саме для цього в `map()` є аргумент `chunksize`: він надсилає елементи робочим процесам пакетами, а не по одному.

```python
import time
from concurrent.futures import ProcessPoolExecutor


def square(n):
    return n * n


if __name__ == "__main__":
    numbers = range(20_000)

    start = time.perf_counter()
    expected = [square(n) for n in numbers]
    print(f"sequential:      {time.perf_counter() - start:.3f} s")

    with ProcessPoolExecutor() as executor:
        for chunksize in (1, 1_000):
            start = time.perf_counter()
            results = list(executor.map(square, numbers, chunksize=chunksize))
            elapsed = time.perf_counter() - start
            print(f"chunksize={chunksize:<6} {elapsed:.3f} s, correct: {results == expected}")
```

Результат (час може відрізнятися):

```text
sequential:      0.001 s
chunksize=1      1.244 s, correct: True
chunksize=1000   0.003 s, correct: True
```

- З `chunksize=1` (типове значення) 20 000 окремих обмінів між процесами зробили пул приблизно в тисячу разів **повільнішим** за звичайний цикл. Перший прогін також платить за запуск робочих процесів, але це лише десятки мілісекунд.
- З `chunksize=1000` для тієї самої роботи знадобилося лише 20 обмінів.
- І навіть тоді послідовний цикл перемагає: піднесення числа до квадрата надто дешеве, щоб кудись його надсилати.

Практичні правила:

- Використовуйте пул процесів, лише коли кожна задача виконує відчутний обсяг роботи (від мілісекунд і більше).
- Коли викликаєте `map()` для багатьох дрібних елементів, передавайте `chunksize`. Щось на кшталт `len(items) // (4 * workers)` — розумний початок.
- `chunksize` впливає лише на `ProcessPoolExecutor`. Пул потоків його ігнорує.
- `buffersize` (Python 3.14+) обмежує, скільки задач надсилається наперед відносно вже спожитих результатів. Це важливо для величезних чи нескінченних вхідних ітерованих об'єктів.

## Винятки з робочих процесів

Виняток, згенерований у робочому процесі, серіалізується, повертається й зберігається у `Future`. `result()` повторно піднімає його в головному процесі, а `exception()` повертає його:

```python
from concurrent.futures import ProcessPoolExecutor


def parse_price(text):
    return float(text)


if __name__ == "__main__":
    with ProcessPoolExecutor() as executor:
        good = executor.submit(parse_price, "19.99")
        bad = executor.submit(parse_price, "free")

        print(good.result())
        print(repr(bad.exception()))
        bad.result()
```

Результат (шляхи скорочено):

```text
19.99
ValueError("could not convert string to float: 'free'")
concurrent.futures.process._RemoteTraceback:
"""
Traceback (most recent call last):
  File ".../concurrent/futures/process.py", line 254, in _process_worker
    r = call_item.fn(*call_item.args, **call_item.kwargs)
  File "/path/to/app.py", line 5, in parse_price
    return float(text)
ValueError: could not convert string to float: 'free'
"""

The above exception was the direct cause of the following exception:

Traceback (most recent call last):
  File "/path/to/app.py", line 15, in <module>
    bad.result()
    ~~~~~~~~~~^^
  ...
ValueError: could not convert string to float: 'free'
```

Трасування (traceback) не можна серіалізувати через pickle, тому робочий процес перетворює його на текст і додає як **причину** (cause) винятку (`_RemoteTraceback`). Ось чому ви бачите два трасування: верхнє показує, де помилка сталася в робочому процесі, нижнє — де `result()` повторно підняв її в головному процесі. Перехоплюйте виняток як завжди: `try`/`except ValueError`.

## Усе перетинає межу процесу

### Функції, аргументи й результати мають підтримувати pickle

Пул надсилає функцію **за іменем**, а її аргументи й результат — **за значенням**. Лямбда-функції та функції, визначені всередині інших функцій, не мають імені, за яким їх можна імпортувати, а деякі об'єкти, як-от генератори, відкриті файли та блокування, взагалі не серіалізуються:

```python
from concurrent.futures import ProcessPoolExecutor


def make_counter(n):
    return (i for i in range(n))  # генератор не можна серіалізувати через pickle


if __name__ == "__main__":
    with ProcessPoolExecutor() as executor:
        for future in (
            executor.submit(lambda x: x * 2, 21),
            executor.submit(make_counter, 3),
        ):
            try:
                print(future.result())
            except Exception as exc:
                print(f"{type(exc).__name__}: {exc}")
```

Результат (адреса щоразу інша):

```text
PicklingError: Can't pickle <function <lambda> at 0x102f68510>: it's not found as __main__.<lambda>
TypeError: cannot pickle 'generator' object
```

Лямбду не вдалося надіслати робочому процесу. `make_counter()` виконалася, але її результат не вдалося повернути. В обох випадках помилка приходить через `Future`, так само як виняток, згенерований самою задачею. Повертайте прості дані: числа, рядки, списки, словники, кортежі, а коли треба зафіксувати частину аргументів, беріть `functools.partial` замість лямбди.

Серіалізація ще й забирає час. Якщо передати список із мільйона елементів кожній зі 100 задач, його буде скопійовано 100 разів. Надсилайте кожній задачі лише ту частину даних, яка їй потрібна, або завантажуйте дані один раз на робочий процес через ініціалізатор.

### Налаштування робочого процесу через `initializer`

Робочі процеси не мають спільних глобальних змінних із головним процесом, але кожен робочий процес може мати **власні**. `initializer` виконується один раз у кожному робочому процесі під час його старту. Це правильне місце для дорогого налаштування: завантаження моделі, відкриття з'єднання з базою даних, читання довідкової таблиці:

```python
import os
from concurrent.futures import ProcessPoolExecutor

vocabulary = None  # кожен робочий процес отримує власну копію цієї глобальної змінної


def load_vocabulary(words):
    global vocabulary
    vocabulary = set(words)  # уявіть повільний крок, наприклад читання великого файлу
    print(f"worker {os.getpid()}: vocabulary loaded")


def check(word):
    return word, word in vocabulary


if __name__ == "__main__":
    words = ["apple", "banana", "cherry", "plum"]
    with ProcessPoolExecutor(
        max_workers=2, initializer=load_vocabulary, initargs=(words,)
    ) as executor:
        for word, known in executor.map(check, ["apple", "kiwi", "plum", "fig"]):
            print(f"{word}: {'known' if known else 'unknown'}")

    print("vocabulary in the main process:", vocabulary)
```

Результат (PID і порядок перших двох рядків змінюються):

```text
worker 58817: vocabulary loaded
worker 58818: vocabulary loaded
apple: known
kiwi: unknown
plum: known
fig: unknown
vocabulary in the main process: None
```

Словник завантажено один раз на робочий процес, а не на кожну задачу. Глобальна змінна головного процесу лишається `None`, бо присвоєння відбувалося в інших процесах. Якщо ініціалізатор згенерує виняток, пул стане непрацездатним (див. наступний розділ).

## Коли робочий процес гине: `BrokenProcessPool`

Звичайний виняток у задачі пулові не шкодить. Але якщо робочий процес **гине** (падає в коді на C, ОС убиває його через надмірне споживання пам'яті або він викликає `os._exit()`), пул не може знати, в якому стані той усе залишив. Тому пул позначає себе як **зламаний** (broken): кожен незавершений `Future` завершується винятком `BrokenProcessPool`, а нові задачі не приймаються.

```python
import os
import time
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool


def crash():
    os._exit(1)  # робочий процес миттєво гине, як після segfault


def slow_square(n):
    time.sleep(0.2)
    return n * n


if __name__ == "__main__":
    with ProcessPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(slow_square, n) for n in range(3)]
        futures.append(executor.submit(crash))

        for future in futures:
            try:
                print("result:", future.result())
            except BrokenProcessPool as exc:
                print("BrokenProcessPool:", exc)

        try:
            executor.submit(slow_square, 10)
        except BrokenProcessPool as exc:
            print("cannot submit:", exc)
```

Результат (які саме задачі встигнуть завершитися, може змінюватися):

```text
result: 0
result: 1
BrokenProcessPool: A process in the process pool was terminated abruptly while the future was running or pending.
BrokenProcessPool: A process in the process pool was terminated abruptly while the future was running or pending.
cannot submit: A child process terminated abruptly, the process pool is not usable anymore
```

`slow_square(2)` нічого поганого не зробила, але на момент загибелі іншого робочого процесу ще не завершилася, тож теж зазнала невдачі. Зламаний пул відремонтувати не можна: створіть новий. Якщо збої очікувані (наприклад, у бібліотеці на C із помилками), виконуйте ризиковану роботу в окремому пулі й будьте готові повторити спробу.

## Завершення роботи, скасування та зупинка робочих процесів

`shutdown()` працює так само, як у пулі потоків. `shutdown(wait=True)`, як і вихід із блоку `with`, чекає на всі надіслані задачі, а `cancel_futures=True` скасовує задачі, які ще не почалися:

```python
import time
from concurrent.futures import ProcessPoolExecutor


def job(n):
    time.sleep(0.3)
    return n


if __name__ == "__main__":
    executor = ProcessPoolExecutor(max_workers=2)
    futures = [executor.submit(job, n) for n in range(8)]
    time.sleep(0.1)
    executor.shutdown(wait=True, cancel_futures=True)
    print([f.cancelled() for f in futures])
```

Результат:

```text
[False, False, False, True, True, True, True, True]
```

Робочих процесів два, а нескасованих задач **три**. Пул процесів заздалегідь переносить одну додаткову задачу у внутрішню чергу, щоб робочі процеси ніколи не чекали на дані. Задача в цій черзі вважається такою, що вже виконується, і скасувати її вже не можна. З `max_workers=N` будьте готові, що навіть після скасування виконається до `N + 1` задач.

Задачі, що виконуються, завжди завершуються, перш ніж `shutdown(wait=True)` поверне керування, і це проблема, коли задача зависла. Починаючи з Python 3.14, пул процесів уміє зупиняти свої робочі процеси ззовні:

- `executor.terminate_workers()` надсилає кожному робочому процесу SIGTERM (`Process.terminate()`) і завершує роботу пулу;
- `executor.kill_workers()` робить те саме із SIGKILL.

`Future` задач, які в цей момент виконувалися, завершуються винятком `BrokenProcessPool`. У вправі 3 це використано, щоб дотриматися крайнього терміну. У пулі потоків аналога немає, бо потоки неможливо зупинити ззовні.

## Практичний приклад: створення мініатюр

У темі «Багатопроцесність: модуль multiprocessing» мініатюри створювалися за допомогою окремого `Process` на кожне зображення. З пулом код стає коротшим і масштабується на будь-яку кількість файлів. Тут потрібні Pillow (`pip install Pillow` у віртуальному середовищі) та п'ять великих тестових зображень із тієї теми:

```python
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image, ImageFilter

filenames = [
    "images/1.jpg",
    "images/2.jpg",
    "images/3.jpg",
    "images/4.jpg",
    "images/5.jpg",
]


def create_thumbnail(filename, size=(50, 50), thumb_dir="thumbs"):
    with Image.open(filename) as img:
        blurred = img.filter(ImageFilter.GaussianBlur())
    blurred.thumbnail(size)
    blurred.save(Path(thumb_dir) / Path(filename).name)
    return f"{filename} was processed..."  # повертаємо, а не виводимо


def main():
    Path("thumbs").mkdir(exist_ok=True)
    start = time.perf_counter()

    with ProcessPoolExecutor() as executor:
        for message in executor.map(create_thumbnail, filenames):
            print(message)

    finish = time.perf_counter()
    print(f"It took {finish - start:.2f} second(s) to finish")


if __name__ == "__main__":
    main()
```

Результат (час може відрізнятися):

```text
images/1.jpg was processed...
images/2.jpg was processed...
images/3.jpg was processed...
images/4.jpg was processed...
images/5.jpg was processed...
It took 0.35 second(s) to finish
```

Як це працює:

1. `ProcessPoolExecutor()` запускає до `os.process_cpu_count()` робочих процесів. Навіть для 50 000 зображень процесів буде саме стільки.
2. `executor.map(create_thumbnail, filenames)` передає кожній задачі одне ім'я файлу й викликає `create_thumbnail(filename)` у робочому процесі. Решта параметрів зберігають типові значення.
3. Робочий процес **повертає** повідомлення, а виводить його головний процес. Результати надходять у порядку вхідних даних, тож рядки завжди йдуть від 1 до 5, на відміну від версії з `Process`.
4. Цикл `for` **споживає** результати. Якщо обробка якогось зображення завершиться помилкою, наприклад через відсутній файл, виняток буде піднято саме тут, а не загублено (див. «Типові помилки»).

## `multiprocessing.Pool`

У модулі `multiprocessing` є власний, старіший клас пулу. Ви зустрінете його в наявному коді:

```python
import multiprocessing


def square(n):
    return n * n


def add(a, b):
    return a + b


if __name__ == "__main__":
    with multiprocessing.Pool(processes=4) as pool:
        print(pool.map(square, range(10)))
        print(pool.starmap(add, [(1, 2), (3, 4)]))
        print(sorted(pool.imap_unordered(square, range(5))))
```

Результат:

```text
[0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
[3, 7]
[0, 1, 4, 9, 16]
```

Він має кілька додаткових можливостей: `starmap()` для кортежів аргументів, ліниві `imap()` / `imap_unordered()` і `maxtasksperchild`. Одна пастка: вихід із блоку `with multiprocessing.Pool()` викликає `terminate()`, а **не** коректне завершення роботи. Незавершену асинхронну роботу буде вбито:

```python
import multiprocessing
import time


def slow_square(n):
    time.sleep(0.5)
    print("finished", n)
    return n * n


if __name__ == "__main__":
    with multiprocessing.Pool(processes=2) as pool:
        async_result = pool.map_async(slow_square, [1, 2])
    print("left the with block")
    print("ready:", async_result.ready())
```

Результат:

```text
left the with block
ready: False
```

`"finished"` так і не з'явилося: робочі процеси примусово завершено посеред роботи. Викличте `async_result.get()` усередині блоку або `pool.close()` і `pool.join()` перед виходом із нього. Для нового коду `ProcessPoolExecutor` зазвичай кращий: він чекає на задачі під час виходу, повторно піднімає винятки через `Future` і має спільний інтерфейс із `ThreadPoolExecutor`.

## Вибір виконавця

| Ситуація | Що використовувати |
|---|---|
| I/O-bound робота (мережа, диск, бази даних) | `ThreadPoolExecutor` або `asyncio` |
| CPU-bound робота на чистому Python | `ProcessPoolExecutor` |
| CPU-bound робота в бібліотеці на C, що звільняє GIL (`hashlib`, `zlib`, NumPy) | Часто достатньо `ThreadPoolExecutor`, і він не має витрат на запуск і серіалізацію (див. вправу 4) |
| Багато крихітних задач | Звичайний цикл або пул процесів із великим `chunksize` |
| CPU-bound робота, експериментально | `InterpreterPoolExecutor` (Python 3.14+): робочі потоки, кожен із власним інтерпретатором і власним GIL, в одному процесі. Його підтримують ще не всі модулі розширень |

## Типові помилки

- **Не споживати результати `map()`.** Винятки зберігаються у `Future`. Якщо їх ніхто не читає, збої тихо зникають. Ця версія ніколи не читає результатів, а одного з файлів не існує:

  ```python
  from concurrent.futures import ProcessPoolExecutor
  from pathlib import Path

  from PIL import Image, ImageFilter

  filenames = ["images/1.jpg", "images/missing.jpg", "images/3.jpg"]


  def create_thumbnail(filename, size=(50, 50), thumb_dir="thumbs"):
      with Image.open(filename) as img:
          blurred = img.filter(ImageFilter.GaussianBlur())
      blurred.thumbnail(size)
      blurred.save(Path(thumb_dir) / Path(filename).name)
      print(f"{filename} was processed...")


  if __name__ == "__main__":
      Path("thumbs").mkdir(exist_ok=True)
      with ProcessPoolExecutor() as executor:
          executor.map(create_thumbnail, filenames)  # результати ніхто не читає
      print("Done, no errors reported")
  ```

  Результат (порядок перших двох рядків може змінюватися):

  ```text
  images/1.jpg was processed...
  images/3.jpg was processed...
  Done, no errors reported
  ```

  `FileNotFoundError` для `missing.jpg` було згенеровано, збережено й так ніхто й не побачив. Завжди проходьте циклом по результатах `map()` або викликайте `result()` для кожного `Future`.
- **Забути `if __name__ == "__main__":`.** Робочі процеси, запущені через `spawn` або `forkserver`, імпортують ваш головний модуль. Незахищене створення пулу завершується помилкою.
- **Надсилати лямбди, вкладені функції чи об'єкти без підтримки pickle.** Визначайте функції для робочих процесів на верхньому рівні модуля й повертайте прості дані.
- **Використовувати пул процесів для крихітних задач без `chunksize`.** Витрати на кожну задачу можуть зробити програму в сотні разів повільнішою за звичайний цикл.
- **Надсилати великі дані з кожною задачею.** Кожен аргумент серіалізується й копіюється. Розбивайте дані на частини або завантажуйте їх один раз на робочий процес через `initializer`.
- **Використовувати пул процесів для I/O-bound роботи.** Очікуванню не потрібні додаткові ядра. Потоки дешевші.
- **Очікувати, що робочі процеси змінять глобальні змінні головного процесу.** Кожен робочий процес має власну пам'ять. Повертайте результати.
- **Очікувати, що `result(timeout=...)` чи `cancel()` зупинить задачу, яка вже виконується.** Тайм-аут лише припиняє очікування, а задачі, що виконуються, скасувати не можна. Починаючи з Python 3.14, `terminate_workers()` зупиняє їх примусово.
- **Виходити з блоку `with multiprocessing.Pool()` до завершення роботи.** Вихід викликає `terminate()` і вбиває незавершені задачі.

## Підсумок

- Пул процесів тримає фіксований набір робочих процесів для повторного використання. `concurrent.futures.ProcessPoolExecutor` надає такий пул з тим самим інтерфейсом `submit()` / `map()` / `shutdown()`, що й у `ThreadPoolExecutor`.
- Використовуйте його для CPU-bound коду на Python: кожен робочий процес має власний інтерпретатор і GIL, тож задачі виконуються на кількох ядрах. Типова кількість робочих процесів — `os.process_cpu_count()`.
- Функції мають бути визначені на рівні модуля, аргументи й результати мають підтримувати pickle, а пул треба створювати під `if __name__ == "__main__":`.
- Кожна задача коштує обміну даними між процесами. Робіть задачі достатньо великими, а для багатьох дрібних елементів передавайте в `map()` параметр `chunksize`.
- Винятки з робочих процесів повторно піднімаються методом `result()` разом із трасуванням із робочого процесу. Завжди споживайте результати.
- `initializer` виконується один раз на робочий процес; це місце для дорогого налаштування кожного процесу.
- Якщо робочий процес гине, пул стає зламаним (`BrokenProcessPool`), і його треба замінити.
- Починаючи з Python 3.14, `terminate_workers()` і `kill_workers()` можуть зупинити робочі процеси, що зависли.

## Практика

### Вправа 1: Прості числа паралельно

Напишіть `is_prime(n)`, яка перевіряє непарні дільники до `math.isqrt(n)`. Перевірте числа нижче за допомогою `ProcessPoolExecutor.map()`, виведіть кожне число з результатом у початковому порядку й порівняйте час із послідовним обчисленням через спискове включення (list comprehension). Переконайтеся, що обидва способи дають однакові результати.

```python
NUMBERS = [
    112272535095293,
    112582705942171,
    112272535095293,
    115280095190773,
    115797848077099,
    1099726899285419,
]
```

### Вправа 2: Прогрес з `as_completed()`

Правило Коллатца перетворює `n` на `n // 2`, якщо воно парне, і на `3 * n + 1`, якщо непарне, доки `n` не стане 1. Знайдіть початкове число, менше за 300 000, з найдовшим ланцюжком (найбільшою кількістю кроків). Розбийте діапазон `[1, 300000)` на 8 частин, надішліть по задачі на кожну частину, яка повертає `(steps, number)` для найкращого числа у своїй частині, і за допомогою `as_completed()` виводьте `chunk k/8 done: [lo, hi)` у міру завершення частин. Потім виведіть загального переможця й загальний час.

### Вправа 3: Крайній термін для пакета задач

Чотири задачі навантажують ядро різний час:

```python
jobs = {"report": 0.2, "backup": 0.4, "stats": 5.0, "cleanup": 0.3}
```

Виконайте їх у пулі процесів із 4 робочими процесами. Через 1 секунду виведіть результат кожної задачі, що завершилася, а для решти — `"<name>: missed the deadline"`. Подбайте, щоб програма справді завершилася приблизно через 1 секунду, а не через 5. Потрібен Python 3.14+.

### Вправа 4: Потоки чи процеси? Виміряйте

Порівняйте послідовний цикл, `ThreadPoolExecutor(max_workers=8)` і `ProcessPoolExecutor(max_workers=8)` для двох CPU-bound функцій, кожну з яких викликають для 8 вхідних значень:

- `hash_password(password)`, що повертає перші 12 шістнадцяткових цифр `hashlib.pbkdf2_hmac("sha256", password.encode(), b"salt", 300_000)`;
- `python_loop(seed)`, що звичайним циклом Python додає `(i * len(seed)) % 7` для `i` з `range(3_000_000)`.

Перевірте, що всі три підходи дають однакові результати, і поясніть час виконання.

## Розв'язки

### Вправа 1

```python
import math
import time
from concurrent.futures import ProcessPoolExecutor

NUMBERS = [
    112272535095293,
    112582705942171,
    112272535095293,
    115280095190773,
    115797848077099,
    1099726899285419,
]


def is_prime(n):
    if n < 2:
        return False
    if n % 2 == 0:
        return n == 2
    for divisor in range(3, math.isqrt(n) + 1, 2):
        if n % divisor == 0:
            return False
    return True


if __name__ == "__main__":
    start = time.perf_counter()
    expected = [is_prime(n) for n in NUMBERS]
    print(f"sequential: {time.perf_counter() - start:.2f} s")

    start = time.perf_counter()
    with ProcessPoolExecutor() as executor:
        results = list(executor.map(is_prime, NUMBERS))
    print(f"pool:       {time.perf_counter() - start:.2f} s")

    for n, prime in zip(NUMBERS, results):
        print(f"{n} is prime: {prime}")
    print("same as sequential:", results == expected)
```

Результат (час може відрізнятися):

```text
sequential: 0.41 s
pool:       0.17 s
112272535095293 is prime: True
112582705942171 is prime: True
112272535095293 is prime: True
115280095190773 is prime: True
115797848077099 is prime: True
1099726899285419 is prime: False
same as sequential: True
```

Кожна перевірка триває десятки мілісекунд, тобто роботи на задачу цілком достатньо, і типового `chunksize=1` вистачає. Пул не може бути швидшим за свою найповільнішу окрему задачу плюс запуск робочих процесів, тому шість задач на десяти ядрах дають пришвидшення приблизно в 2,4 раза, а не в шість.

### Вправа 2

```python
import time
from concurrent.futures import ProcessPoolExecutor, as_completed

LIMIT = 300_000
CHUNKS = 8


def collatz_steps(n):
    steps = 0
    while n != 1:
        n = n // 2 if n % 2 == 0 else 3 * n + 1
        steps += 1
    return steps


def longest_in_range(start, stop):
    """Return (steps, number) for the longest chain that starts in [start, stop)."""
    return max((collatz_steps(n), n) for n in range(start, stop))


if __name__ == "__main__":
    size = -(-(LIMIT - 1) // CHUNKS)  # ділення з округленням угору
    bounds = [(s, min(s + size, LIMIT)) for s in range(1, LIMIT, size)]

    start = time.perf_counter()
    with ProcessPoolExecutor() as executor:
        future_to_bounds = {
            executor.submit(longest_in_range, lo, hi): (lo, hi) for lo, hi in bounds
        }
        best = (0, 1)
        for done_count, future in enumerate(as_completed(future_to_bounds), 1):
            lo, hi = future_to_bounds[future]
            best = max(best, future.result())
            print(f"chunk {done_count}/{len(bounds)} done: [{lo}, {hi})")

    steps, number = best
    print(f"longest chain below {LIMIT}: {number} ({steps} steps)")
    print(f"took {time.perf_counter() - start:.2f} s")
```

Результат (порядок частин і час змінюються):

```text
chunk 1/8 done: [1, 37501)
chunk 2/8 done: [150001, 187501)
chunk 3/8 done: [37501, 75001)
chunk 4/8 done: [75001, 112501)
chunk 5/8 done: [112501, 150001)
chunk 6/8 done: [187501, 225001)
chunk 7/8 done: [225001, 262501)
chunk 8/8 done: [262501, 300000)
longest chain below 300000: 230631 (442 steps)
took 0.34 s
```

Послідовний пошук на тій самій машині триває близько 1,3 секунди. Кортежі порівнюються поелементно, тому `max()` по парах `(steps, number)` обирає найдовший ланцюжок. Словник `future_to_bounds` підказує, якій частині належить кожен завершений `Future`.

### Вправа 3

```python
import time
from concurrent.futures import ProcessPoolExecutor, wait


def busy(seconds):
    """Keep one core busy for about `seconds` seconds."""
    end = time.perf_counter() + seconds
    while time.perf_counter() < end:
        pass
    return f"{seconds} s of work"


jobs = {"report": 0.2, "backup": 0.4, "stats": 5.0, "cleanup": 0.3}

if __name__ == "__main__":
    start = time.perf_counter()
    executor = ProcessPoolExecutor(max_workers=4)
    future_to_name = {executor.submit(busy, sec): name for name, sec in jobs.items()}

    done, not_done = wait(future_to_name, timeout=1)

    for future, name in future_to_name.items():
        if future in done:
            print(f"{name}: {future.result()}")
        else:
            print(f"{name}: missed the deadline")

    executor.terminate_workers()  # Python 3.14+: зупиняємо робочий процес, що застряг
    print(f"total: {time.perf_counter() - start:.1f} s")
```

Результат (час може трохи відрізнятися):

```text
report: 0.2 s of work
backup: 0.4 s of work
stats: missed the deadline
cleanup: 0.3 s of work
total: 1.0 s
```

`wait(..., timeout=1)` повертається через секунду з множинами завершених і незавершених `Future`. Блок `with` тут навмисно не використано: вихід із нього чекав би всі 5 секунд на `stats`. Без `terminate_workers()` скрипт однаково вивів би `total: 1.0 s`, але потім інтерпретатор під час виходу чекав би на робочий процес, що працює, і програма завершилася б лише приблизно через 5 секунд. `terminate_workers()` зупиняє робочий процес, а `Future` задачі `stats` завершується винятком `BrokenProcessPool`.

### Вправа 4

```python
import hashlib
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor

PASSWORDS = [f"password{i}" for i in range(8)]


def hash_password(password):
    # основну роботу виконує код на C усередині hashlib
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), b"salt", 300_000)
    return digest.hex()[:12]


def python_loop(seed):
    # чистий Python: основну роботу виконує інтерпретатор
    total = 0
    for i in range(3_000_000):
        total += (i * len(seed)) % 7
    return total


def measure(label, func, executor_class=None):
    start = time.perf_counter()
    if executor_class is None:
        results = [func(p) for p in PASSWORDS]
    else:
        with executor_class(max_workers=8) as executor:
            results = list(executor.map(func, PASSWORDS))
    print(f"{label:<28} {time.perf_counter() - start:.2f} s")
    return results


if __name__ == "__main__":
    for func in (hash_password, python_loop):
        print(f"--- {func.__name__}")
        expected = measure("sequential", func)
        assert measure("ThreadPoolExecutor", func, ThreadPoolExecutor) == expected
        assert measure("ProcessPoolExecutor", func, ProcessPoolExecutor) == expected
```

Результат (час може відрізнятися; стандартний CPython із GIL):

```text
--- hash_password
sequential                   0.35 s
ThreadPoolExecutor           0.08 s
ProcessPoolExecutor          0.16 s
--- python_loop
sequential                   0.59 s
ThreadPoolExecutor           0.57 s
ProcessPoolExecutor          0.20 s
```

- `pbkdf2_hmac()` працює на C і **звільняє GIL** під час обчислень, тож вісім потоків справді виконуються на восьми ядрах. Тут потоки навіть випереджають процеси: вони стартують за мікросекунди й не потребують серіалізації.
- `python_loop()` виконує байт-код Python, якому потрібен GIL. Потоки чергувалися, і справжнє пришвидшення дав лише пул процесів.
- Обидві задачі CPU-bound, але найкращий інструмент для них різний. Коли сумніваєтеся, вимірюйте.

---

*Джерело: [pythontutorial.net — Python ProcessPoolExecutor](https://www.pythontutorial.net/python-concurrency/python-processpoolexecutor/). Адаптовано й доповнено для PyJourney.*
