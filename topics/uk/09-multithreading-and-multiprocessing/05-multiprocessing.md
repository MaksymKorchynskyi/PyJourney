# Багатопроцесність: модуль multiprocessing

У стандартному CPython потоки не пришвидшують код на Python, що інтенсивно навантажує процесор: GIL дозволяє виконувати байт-код лише одному потоку водночас. Модуль `multiprocessing` обходить це обмеження, запускаючи роботу в **окремих процесах**. Кожен процес має власний інтерпретатор і власний GIL, тож кілька процесів справді можуть обчислювати паралельно на різних ядрах процесора.

## Що ви дізнаєтесь

- Коли багатопроцесність пришвидшує програму, а коли ні
- Як виконувати функції паралельно за допомогою `multiprocessing.Process`, `start()` і `join()`
- Навіщо коду, що запускає процеси, потрібен `if __name__ == "__main__":` і що таке способи запуску
- Як передати процесу аргументи і чому його повернене значення губиться
- Як повернути результати через `Queue` і спільно використовувати число через `Value`
- Як читати коди завершення, реагувати на збої та зупиняти процес, що завис
- Практичний приклад: паралельне створення мініатюр зображень за допомогою Pillow

## Коли багатопроцесність допомагає

Програми витрачають час на два види роботи (докладно про них ідеться в темі «Процеси та потоки»):

- Задачі, **обмежені введенням-виведенням** (I/O-bound), здебільшого *чекають*: на файли, бази даних, відповіді мережі. Потоки або `asyncio` дешево їх пришвидшують, бо потік, що чекає, звільняє GIL.
- Задачі, **обмежені процесором** (CPU-bound), здебільшого *обчислюють*: числові розрахунки, зміна розміру зображень, кодування відео, стиснення. Тут немає очікування, яке можна перекрити. Єдиний спосіб закінчити швидше — задіяти **більше ядер одночасно**.

Під GIL два потоки, які обидва обчислюють, лише чергуються. Два **процеси** не мають спільного GIL, тому на машині з двома чи більше ядрами вони справді працюють в один і той самий момент. Саме це й означає багатопроцесність (multiprocessing): два чи більше процесори одночасно опрацьовують різні частини програми.

Ціна — накладні витрати. Запуск процесу триває мілісекунди, а не мікросекунди, процеси не мають спільної пам'яті, і кожен аргумент та результат доводиться копіювати між ними. Багатопроцесність окупається, коли кожна порція роботи достатньо велика, щоб переважити ці витрати.

> **Зверніть увагу:** API `multiprocessing` навмисно повторює `threading`. Якщо ви знаєте `Thread(target=..., args=...)`, `start()` і `join()` з теми «Потоки: модуль threading», то вже знаєте більшу частину `Process`.

## CPU-bound задача, виконана послідовно

Функція нижче не робить нічого корисного, зате тримає одне ядро процесора зайнятим: 100 мільйонів разів збільшує лічильник.

```python
import time


def task():
    result = 0
    for _ in range(10**8):
        result += 1
    return result


if __name__ == "__main__":
    start = time.perf_counter()
    task()
    task()
    finish = time.perf_counter()

    print(f"It took {finish - start:.2f} second(s) to finish")
```

Результат (час залежить від комп'ютера та версії Python):

```text
It took 1.88 second(s) to finish
```

Два виклики виконуються один за одним, тому загальний час приблизно вдвічі більший за час одного виклику. Працює лише одне ядро.

## Робота в процесах: `Process`, `start()`, `join()`

Ось та сама робота, розподілена між двома процесами:

```python
import multiprocessing
import time


def task():
    result = 0
    for _ in range(10**8):
        result += 1
    return result


if __name__ == "__main__":
    start = time.perf_counter()

    p1 = multiprocessing.Process(target=task)
    p2 = multiprocessing.Process(target=task)

    p1.start()
    p2.start()

    p1.join()
    p2.join()

    finish = time.perf_counter()
    print(f"It took {finish - start:.2f} second(s) to finish")
```

Результат (час може відрізнятися):

```text
It took 1.06 second(s) to finish
```

Як це працює:

1. `multiprocessing.Process(target=task)` створює об'єкт `Process`. Він лише описує роботу, але ще нічого не запускає. Передавайте саму функцію, `target=task`, а не результат її виклику `target=task()`.
2. `p1.start()` просить операційну систему створити новий процес і виконує в ньому `task()`. `start()` повертається одразу, тож головний процес може відразу запустити `p2`. Тепер обидві задачі обчислюються паралельно на двох ядрах.
3. `p1.join()` блокує головний процес, доки `p1` не завершиться, а `p2.join()` робить те саме для `p2`. Без `join()` головний процес вивів би час раніше, ніж робота закінчилася.

Програма стала швидшою приблизно в 1,8 раза, а не рівно вдвічі. Кожен процес треба було запустити: стартувати новий інтерпретатор Python та імпортувати модуль. Для задачі тривалістю в секунду ці витрати невеликі. Для задачі в кілька мілісекунд вони перевищили б саму роботу.

```text
послідовно:  main  [ task ][ task ]                -> приблизно 2 x T

паралельно:  main  start start ......... join join
             p1          [ task ]
             p2          [ task ]                  -> приблизно T + витрати на запуск
```

## Навіщо потрібен `if __name__ == "__main__":`

У кожному прикладі вище код, що запускає процеси, стоїть під `if __name__ == "__main__":`. У `multiprocessing` це не просто гарний стиль, а вимога. Причина в тому, як створюється дочірній процес. Механізм створення називається **способом запуску** (start method), і їх три:

| Спосіб запуску | Як стартує дочірній процес | Типовий на |
|---|---|---|
| `spawn` | Запускає новий інтерпретатор Python, який **повторно імпортує ваш головний модуль** і потім викликає цільову функцію | Windows, macOS (починаючи з Python 3.8) |
| `forkserver` | Невеликий серверний процес, запущений один раз, на кожен запит робить fork нового дочірнього процесу. Головний модуль у дочірньому процесі теж імпортується | Linux та інші POSIX-системи (починаючи з Python 3.14) |
| `fork` | Копіює батьківський процес через `os.fork()`. Нічого не імпортується повторно, дочірній процес продовжує роботу з копії пам'яті батька | Linux до Python 3.14. Небезпечний, коли в батьківському процесі є потоки |

Можна побачити, як `spawn` повторно імпортує модуль:

```python
import multiprocessing
import os

print(f"module loaded: __name__={__name__!r}, PID={os.getpid()}")


def work():
    print(f"work() runs in PID {os.getpid()}")


if __name__ == "__main__":
    print("start method:", multiprocessing.get_start_method())
    p = multiprocessing.Process(target=work)
    p.start()
    p.join()
    print("main is done")
```

Результат на macOS або Windows (PID щоразу інші):

```text
module loaded: __name__='__main__', PID=55194
start method: spawn
module loaded: __name__='__mp_main__', PID=55196
work() runs in PID 55196
main is done
```

`print()` на верхньому рівні модуля спрацював **двічі**: у батьківському процесі й у дочірньому. У дочірньому процесі модуль імпортується під іменем `__mp_main__`, тому блок `if` там пропускається. Без цієї перевірки дочірній процес під час імпорту дійшов би до `p.start()` і спробував би запустити власний процес. Python зупиняє це винятком `RuntimeError` у дочірньому процесі:

```text
RuntimeError:
        An attempt has been made to start a new process before the
        current process has finished its bootstrapping phase.
        ...
```

Цільова функція так і не виконується. Тримайте весь код верхнього рівня, який запускає процеси або виконує іншу роботу, усередині цієї перевірки, а поза нею залишайте лише імпорти, константи й визначення функцій та класів.

Спосіб запуску можна перевірити або обрати явно:

```python
import multiprocessing

print(multiprocessing.get_all_start_methods())  # на macOS: ['spawn', 'fork', 'forkserver']
ctx = multiprocessing.get_context("spawn")       # контекст, який завжди використовує spawn
print(ctx.get_start_method())                    # spawn
```

`ctx.Process(...)`, `ctx.Queue()` тощо створюють об'єкти, що використовують цей спосіб запуску. `multiprocessing.set_start_method("spawn")` змінює типовий спосіб для всієї програми, але викликати його можна лише один раз і лише всередині перевірки `__main__`. Найнадійніше писати код, який працює зі `spawn`: тоді він працює на будь-якій платформі.

## Передавання аргументів

`Process` приймає ті самі аргументи, що й `Thread`: `target`, `args` (кортеж позиційних аргументів), `kwargs` (словник іменованих аргументів) і `name`:

```python
import multiprocessing
import os


def greet(name, greeting="Hello"):
    me = multiprocessing.current_process()
    print(f"{greeting}, {name}! (from {me.name}, PID {os.getpid()})")


if __name__ == "__main__":
    p1 = multiprocessing.Process(target=greet, args=("Olena",))
    p2 = multiprocessing.Process(
        target=greet, args=("Max",), kwargs={"greeting": "Hi"}, name="greeter"
    )
    p1.start()
    p1.join()
    p2.start()
    p2.join()
```

Результат (PID щоразу інші):

```text
Hello, Olena! (from Process-1, PID 55295)
Hi, Max! (from greeter, PID 55296)
```

- `args=("Olena",)` потребує коми в кінці. `("Olena")` — це просто рядок у дужках, а не кортеж.
- Процеси отримують типові імена `Process-1`, `Process-2`, ..., якщо не передати `name=`. Усередині процесу `multiprocessing.current_process()` повертає його власний об'єкт `Process`.

### Усе копіюється через pickle

Дочірній процес не має спільної пам'яті з батьківським, тому цільову функцію та її аргументи треба йому **надіслати**. При `spawn` і `forkserver` модуль `multiprocessing` серіалізує їх за допомогою `pickle`. Звідси два наслідки:

- Аргументи мають підтримувати pickle. Числа, рядки, списки, словники, кортежі та екземпляри звичайних класів підходять. Відкриті файли, сокети, блокування з `threading` і генератори — ні.
- Цільова функція має бути такою, яку дочірній процес може **імпортувати за іменем**, тобто визначеною на верхньому рівні модуля. Лямбда-функції та функції, вкладені в інші функції, не працюють:

```python
import multiprocessing

if __name__ == "__main__":
    p = multiprocessing.Process(target=lambda: print("hi"))
    p.start()
    p.join()
```

Результат (Python 3.14 на macOS; адреса щоразу інша):

```text
Traceback (most recent call last):
  ...
_pickle.PicklingError: Can't pickle <function <lambda> at 0x10076b110>: it's not found as __main__.<lambda>
when serializing dict item '_target'
when serializing multiprocessing.context.Process state
when serializing multiprocessing.context.Process object
```

Помилку генерує `p.start()` у батьківському процесі. Крім того, кожен дочірній процес працює з **копією** аргументів, тож зміна отриманого списку ніколи не змінює список батьківського процесу.

## Стан процесу: `pid`, `is_alive()`, `exitcode`

Об'єкт `Process` повідомляє про стан свого процесу:

```python
import multiprocessing
import time


def work(seconds):
    time.sleep(seconds)


if __name__ == "__main__":
    p = multiprocessing.Process(target=work, args=(0.5,), name="sleeper")
    print("before start:", p.name, p.pid, p.is_alive(), p.exitcode)

    p.start()
    print("running:     ", p.name, p.pid, p.is_alive(), p.exitcode)

    p.join()
    print("after join:  ", p.name, p.pid, p.is_alive(), p.exitcode)
```

Результат (PID щоразу інший):

```text
before start: sleeper None False None
running:      sleeper 55304 True None
after join:   sleeper 55304 False 0
```

| Атрибут або метод | Значення |
|---|---|
| `pid` | Ідентифікатор процесу в ОС, `None` до виклику `start()` |
| `is_alive()` | `True` від `start()` до завершення процесу |
| `exitcode` | `None`, поки процес працює. `0` — успіх, додатне число — помилка, `-N` — процес убито сигналом `N` (POSIX) |
| `join(timeout=None)` | Чекати на завершення процесу, щонайбільше `timeout` секунд, якщо його задано |
| `daemon` | Якщо встановити `True` до `start()`, дочірній процес автоматично завершиться разом із батьківським |
| `terminate()` / `kill()` | Зупинити процес сигналом SIGTERM / SIGKILL (у Windows обидва викликають `TerminateProcess()`) |
| `close()` | Звільнити ресурси об'єкта `Process` після завершення процесу |

## Повернені значення губляться: як передати результати назад

Погляньте ще раз на `task()` з першого прикладу: вона повертає `result`, але цього значення ніхто не бачить. Цільова функція виконується в іншому процесі, і `Process` просто відкидає повернене значення. Атрибута `p.result` немає:

```python
import multiprocessing


def task():
    return 42


if __name__ == "__main__":
    p = multiprocessing.Process(target=task)
    p.start()
    p.join()
    print(p.exitcode)
    print(hasattr(p, "result"))
```

Результат:

```text
0
False
```

Щоб отримати дані назад, дочірній процес має **надіслати** їх каналом, що з'єднує процеси. Найпоширеніший — `multiprocessing.Queue`, безпечна для процесів черга FIFO. Тут чотири процеси рахують прості числа в чотирьох діапазонах і кладуть відповіді в чергу:

```python
import multiprocessing


def count_primes(start, stop, results):
    count = 0
    for n in range(max(start, 2), stop):
        if all(n % d for d in range(2, int(n**0.5) + 1)):
            count += 1
    results.put((start, stop, count))  # надсилаємо результат батьківському процесу


if __name__ == "__main__":
    ranges = [(0, 25_000), (25_000, 50_000), (50_000, 75_000), (75_000, 100_000)]
    results = multiprocessing.Queue()

    processes = [
        multiprocessing.Process(target=count_primes, args=(start, stop, results))
        for start, stop in ranges
    ]
    for p in processes:
        p.start()

    # читаємо по одному повідомленню від кожного процесу ДО join()
    partial = [results.get() for _ in processes]

    for p in processes:
        p.join()

    for start, stop, count in sorted(partial):
        print(f"[{start:>6}, {stop:>6}): {count} primes")
    print("total:", sum(count for _, _, count in partial))
```

Результат:

```text
[     0,  25000): 2762 primes
[ 25000,  50000): 2371 primes
[ 50000,  75000): 2260 primes
[ 75000, 100000): 2199 primes
total: 9592
```

Важливі деталі:

- Черга передається кожному дочірньому процесу **як аргумент**. Черга, створена як глобальна змінна, у кожному дочірньому процесі, запущеному через `spawn`, була б іншою, ні з чим не пов'язаною чергою.
- `results.get()` блокує виконання, доки не надійде повідомлення. Повідомлення приходять у порядку **завершення** процесів, а він щоразу різний, тому кожне повідомлення містить свій діапазон, а список потім сортується.
- Викликайте `get()` **перед** `join()`. Перш ніж завершитися, дочірній процес чекає, доки все, що він поклав у чергу, не буде передано в канал (pipe), на якому вона побудована. Якщо даних більше, ніж уміщує буфер каналу, це станеться лише тоді, коли батьківський процес їх прочитає, тож `join()` першим може спричинити взаємне блокування (deadlock).

Інші способи обміну даними:

- `multiprocessing.Pipe()` повертає два з'єднані кінці для двостороннього обміну між рівно двома процесами.
- `multiprocessing.Value` і `multiprocessing.Array` розміщують числа в **спільній пам'яті**, яку кілька процесів можуть читати й записувати напряму.
- `multiprocessing.Manager()` запускає серверний процес, що зберігає спільні списки, словники та інші об'єкти. Це гнучко, але кожне звернення — це повідомлення до сервера, тож працює повільно.

### Спільна пам'ять потребує блокування

`Value` — спільний об'єкт, тож класичний стан гонитви з теми «Блокування потоків: Lock» повертається. `counter.value += 1` — це читання, додавання й запис, і між ними можуть втрутитися інші процеси:

```python
import multiprocessing


def add_unsafe(counter, times):
    for _ in range(times):
        counter.value += 1  # прочитати, додати, записати: три окремі кроки


def add_safe(counter, times):
    for _ in range(times):
        with counter.get_lock():  # лише один процес за раз
            counter.value += 1


def run(worker):
    counter = multiprocessing.Value("i", 0)  # C-тип int у спільній пам'яті
    processes = [
        multiprocessing.Process(target=worker, args=(counter, 10_000))
        for _ in range(4)
    ]
    for p in processes:
        p.start()
    for p in processes:
        p.join()
    return counter.value


if __name__ == "__main__":
    print("without the lock:", run(add_unsafe))
    print("with the lock:   ", run(add_safe))
```

Результат (перше число щоразу інше):

```text
without the lock: 11972
with the lock:    40000
```

`"i"` — код типу з модуля `array`: знаковий C-тип `int`. `get_lock()` повертає блокування, яке має кожен `Value`. `multiprocessing.Lock` теж працює так само, як `threading.Lock`. На практиці краще проєктувати програму так, щоб кожен процес обчислював свою частину й **повертав** її, як у прикладі з чергою. Спільний стан повільніший, і в ньому легше помилитися.

## Помилки, коди завершення та зупинка процесу

Виняток у дочірньому процесі **не доходить до батьківського**. Дочірній процес виводить трасування у свій потік помилок (stderr) і завершується з кодом `1`. Дочірній процес також може сам обрати код завершення через `sys.exit(n)`, а процес, що завис, можна зупинити ззовні, чого з потоками зробити неможливо:

```python
import multiprocessing
import sys
import time


def ok():
    pass


def fails():
    raise ValueError("bad input")


def exits():
    sys.exit(3)


def hangs():
    time.sleep(60)


if __name__ == "__main__":
    processes = [
        multiprocessing.Process(target=func, name=func.__name__)
        for func in (ok, fails, exits, hangs)
    ]
    for p in processes:
        p.start()

    for p in processes[:3]:
        p.join()

    stuck = processes[3]
    stuck.join(timeout=0.5)  # чекаємо щонайбільше 0,5 с
    if stuck.is_alive():
        stuck.terminate()    # надсилаємо SIGTERM (TerminateProcess у Windows)
        stuck.join()

    for p in processes:
        print(f"{p.name:<6} exitcode={p.exitcode}")
```

Результат (трасування скорочено):

```text
Process fails:
Traceback (most recent call last):
  ...
ValueError: bad input
ok     exitcode=0
fails  exitcode=1
exits  exitcode=3
hangs  exitcode=-15
```

- `fails` вивів своє трасування, але батьківський процес працював далі. Єдиний слід, який він отримав, — `exitcode=1`. Перевіряйте коди завершення або перехоплюйте винятки в дочірньому процесі й надсилайте повідомлення про помилку через чергу.
- `join(timeout=0.5)` повертається через пів секунди, хоча процес ще працює. Після цього `is_alive()` показує, що сталося.
- `terminate()` завершив процес сигналом 15 (SIGTERM), звідси `-15`. У Windows сигналів немає, але `multiprocessing` і там повідомляє про примусово завершений процес як про `-15`.
- Примусово завершений процес не має змоги прибрати за собою: блоки `finally` і виходи з `with` не виконуються, а черга чи блокування, з якими він працював, можуть лишитися зіпсованими. Використовуйте `terminate()` в аварійних випадках, а коли можливо, зупиняйте процеси узгоджено (наприклад, через `multiprocessing.Event`).

## Підкласи `Process`

Як і від `Thread`, від `Process` можна успадковуватися. Перевизначте `run()` — метод, який `start()` викликає в дочірньому процесі:

```python
import multiprocessing


class Squarer(multiprocessing.Process):
    def __init__(self, number):
        super().__init__(name=f"squarer-{number}")
        self.number = number

    def run(self):
        print(f"{self.name}: {self.number} squared is {self.number**2}")


if __name__ == "__main__":
    workers = [Squarer(n) for n in (3, 4)]
    for w in workers:
        w.start()
    for w in workers:
        w.join()
```

Результат (порядок рядків може змінюватися):

```text
squarer-3: 3 squared is 9
squarer-4: 4 squared is 16
```

Завжди викликайте `super().__init__()`. При `spawn` увесь об'єкт серіалізується через pickle і надсилається дочірньому процесу, тож його атрибути мають підтримувати pickle. Усе, що `run()` присвоює `self`, змінює лише копію об'єкта в дочірньому процесі (див. вправу 4).

## Практичний приклад: створення мініатюр

Обробка зображень — класична CPU-bound задача. Програма нижче робить маленькі розмиті мініатюри великих фотографій за допомогою **Pillow**, найпопулярнішої бібліотеки для роботи із зображеннями в Python. Спочатку встановіть її у віртуальне середовище:

```bash
python -m venv .venv
source .venv/bin/activate   # у Windows: .venv\Scripts\activate
pip install Pillow
```

Програма очікує п'ять файлів JPEG у теці `images`. Якщо фотографій під рукою немає, цей скрипт створить п'ять великих тестових зображень, заповнених випадковим шумом:

```python
from pathlib import Path

from PIL import Image

folder = Path("images")
folder.mkdir(exist_ok=True)

for i in range(1, 6):
    # три канали випадкового шуму дають велике «строкате» фото на 12 мегапікселів
    channels = [Image.effect_noise((4000, 3000), 40 + 10 * i) for _ in range(3)]
    Image.merge("RGB", channels).save(folder / f"{i}.jpg", quality=90)
    print(f"created images/{i}.jpg")
```

### Послідовна версія

```python
import time
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
        # найдорожча частина: розмиття повнорозмірного зображення
        blurred = img.filter(ImageFilter.GaussianBlur())
    blurred.thumbnail(size)  # зменшуємо на місці, зберігаючи пропорції
    blurred.save(Path(thumb_dir) / Path(filename).name)
    print(f"{filename} was processed...")


if __name__ == "__main__":
    Path("thumbs").mkdir(exist_ok=True)
    start = time.perf_counter()

    for filename in filenames:
        create_thumbnail(filename)

    finish = time.perf_counter()
    print(f"It took {finish - start:.2f} second(s) to finish")
```

Результат (час може відрізнятися):

```text
images/1.jpg was processed...
images/2.jpg was processed...
images/3.jpg was processed...
images/4.jpg was processed...
images/5.jpg was processed...
It took 1.00 second(s) to finish
```

Для кожного файлу `create_thumbnail()` відкриває зображення, застосовує розмиття за Гаусом до повнорозмірної картинки, зменшує результат методом `thumbnail()` (він зберігає пропорції, тож фото 4000 x 3000 стає 50 x 38) і зберігає його в теку `thumbs` під тим самим іменем. Блок `with` закриває файл, а `mkdir(exist_ok=True)` створює вихідну теку, якщо її ще немає. Без цього `save()` завершився б помилкою `FileNotFoundError`.

### Паралельна версія

Тепер кожне зображення отримує власний процес:

```python
import multiprocessing
import time
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
        # найдорожча частина: розмиття повнорозмірного зображення
        blurred = img.filter(ImageFilter.GaussianBlur())
    blurred.thumbnail(size)  # зменшуємо на місці, зберігаючи пропорції
    blurred.save(Path(thumb_dir) / Path(filename).name)
    print(f"{filename} was processed...")


def main():
    Path("thumbs").mkdir(exist_ok=True)
    start = time.perf_counter()

    # створюємо по процесу на кожне зображення
    processes = [
        multiprocessing.Process(target=create_thumbnail, args=(filename,))
        for filename in filenames
    ]

    # запускаємо процеси
    for process in processes:
        process.start()

    # чекаємо на їхнє завершення
    for process in processes:
        process.join()

    finish = time.perf_counter()
    print(f"It took {finish - start:.2f} second(s) to finish")


if __name__ == "__main__":
    main()
```

Результат (порядок рядків і час змінюються):

```text
images/2.jpg was processed...
images/1.jpg was processed...
images/3.jpg was processed...
images/5.jpg was processed...
images/4.jpg was processed...
It took 0.34 second(s) to finish
```

П'ять зображень оброблено одночасно на п'яти ядрах, приблизно втричі швидше. Рядки тепер з'являються в порядку **завершення** процесів, і щоразу він інший.

Процес на кожен елемент — нормальний підхід для п'яти файлів, але не для п'яти тисяч: ви одночасно запустили б тисячі інтерпретаторів і перевантажили б машину. Правильний інструмент для великої кількості елементів — **пул процесів**. Він тримає фіксовану кількість робочих процесів (зазвичай по одному на ядро) і роздає їм задачі. До того ж він сам повертає батьківському процесу результати й винятки. Про нього йдеться в наступній темі, «Пул процесів».

## Скільки процесів запускати?

Для CPU-bound роботи процеси понад кількість ядер не допомагають: вони лише чергуються на тих самих ядрах і додають витрат на пам'ять та перемикання. Добре типове значення — кількість процесорів, доступних вашому процесу:

```python
import os

print(os.process_cpu_count())  # напр. 10 (Python 3.13+; у старіших версіях — os.cpu_count())
```

## Типові помилки

- **Забути `if __name__ == "__main__":`.** При `spawn` і `forkserver` дочірній процес імпортує ваш модуль. Незахищений код, що запускає процеси, падає в дочірньому процесі з `RuntimeError`, і робота так і не виконується.
- **Очікувати повернене значення цільової функції.** `Process` його відкидає. Надсилайте результати через `Queue` чи `Pipe` або користуйтеся пулом процесів.
- **Писати `args=(x)` замість `args=(x,)`.** Без коми кортежу немає. `Process` перетворює `args` на кортеж, тож ціле число спричинить `TypeError: 'int' object is not iterable`, а рядок розпадеться на окремі символи.
- **Викликати цільову функцію самому: `Process(target=task())`.** Так `task()` виконується в батьківському процесі, а цільовою функцією стає її результат.
- **Використовувати лямбди, вкладені функції чи аргументи без підтримки pickle.** При `spawn` цільова функція шукається за іменем, а аргументи серіалізуються через pickle. Визначайте цільові функції на верхньому рівні модуля.
- **Запускати код із `multiprocessing` в інтерактивному сеансі.** Функцію, набрану в REPL (а в деяких середовищах і в комірці Jupyter), дочірній процес, запущений через `spawn`, імпортувати не може й падає з помилкою на кшталт `AttributeError: module '__main__' has no attribute 'work'`. Збережіть код у файл `.py`.
- **Очікувати, що зміни глобальних змінних дійдуть до батьківського процесу.** Кожен процес має власну пам'ять. Дочірній процес, що додає елемент до глобального списку, змінює лише свою копію.
- **Викликати `join()` до того, як черга спорожніла.** Дочірній процес, що поклав у чергу багато даних, не може завершитися, доки батьківський процес їх не прочитає, тож `join()` чекатиме вічно. Спочатку `get()`, потім `join()`.
- **Використовувати процеси для дрібних або I/O-bound задач.** Витрати на запуск і серіалізацію можуть зробити програму повільнішою за послідовну версію. Для очікування беріть потоки чи `asyncio`, для важких обчислень — процеси.
- **Запускати по процесу на кожен елемент довгого списку.** Використовуйте пул приблизно з `os.process_cpu_count()` робочими процесами.

## Підсумок

- `multiprocessing` виконує код в окремих процесах, кожен з яких має власний інтерпретатор і GIL, тож CPU-bound код на Python може працювати паралельно на кількох ядрах.
- Процес створюють через `Process(target=func, args=(...))`, запускають методом `start()` і чекають на нього методом `join()`.
- При способі запуску `spawn` (Windows, macOS) і `forkserver` (Linux, починаючи з 3.14) дочірній процес повторно імпортує головний модуль, тому код, що запускає процеси, має бути під `if __name__ == "__main__":`.
- Цільова функція та її аргументи серіалізуються через pickle і копіюються в дочірній процес: використовуйте функції верхнього рівня й дані, що підтримують pickle.
- `Process` відкидає повернені значення. Передавайте результати назад через `Queue` (читайте її до `join()`) або `Pipe`, а спільні об'єкти `Value` захищайте їхнім блокуванням.
- Виняток у дочірньому процесі не доходить до батьківського. Перевіряйте `exitcode`: `0` — успіх, додатне число — помилка, від'ємне — сигнал.
- На відміну від потоків, процеси можна зупинити ззовні методами `terminate()` або `kill()`, але тоді вони не виконають прибирання.
- Запуск процесу дорогий. Для великої кількості задач використовуйте пул процесів приблизно з одним робочим процесом на ядро.

## Практика

### Вправа 1: Виправте програму

Програма нижче має обчислити в трьох процесах суми квадратів чисел, менших за 10, 100 і 1000, та вивести їх. У ній три помилки. Знайдіть і виправте їх, а результати повертайте через `Queue`. Виведіть результати, відсортовані за `n`.

```python
import multiprocessing


def sum_of_squares(n):
    return sum(i * i for i in range(n))


processes = []
for n in (10, 100, 1000):
    p = multiprocessing.Process(target=sum_of_squares, args=(n))
    p.start()
    processes.append(p)

for p in processes:
    p.join()
    print(p.result)
```

### Вправа 2: Розподіліть роботу

Напишіть `parallel_sum(n, workers)`, яка обчислює `sum(i * i for i in range(n))`: розбиває `range(n)` на `workers` суцільних частин, обчислює кожну частину в окремому процесі й додає часткові суми, отримані через `Queue`. Для `n = 30_000_000` і `workers = os.process_cpu_count()` виміряйте послідовний і паралельний час та перевірте, що результат дорівнює і послідовній сумі, і формулі `(n - 1) * n * (2 * n - 1) // 6`.

### Вправа 3: Сторожовий таймер

Напишіть `run_with_timeout(func, timeout)`, яка виконує `func` в окремому процесі й чекає щонайбільше `timeout` секунд. Якщо після цього процес ще працює, примусово завершіть його. Поверніть `"<name>: finished (exitcode N)"` або `"<name>: timed out (exitcode N)"`. Перевірте її на `quick_job()`, що спить 0,2 секунди, і на `endless_job()`, що крутиться в нескінченному циклі, з тайм-аутом 1 секунда.

### Вправа 4: Зниклий результат

Запустіть цю програму. Вона виводить `None`. Поясніть чому, а потім виправте її так, щоб батьківський процес після `join()` міг прочитати результат кожного `PrimeCounter`. Скористайтеся `multiprocessing.Value`. Перевірте на межах 100, 1000 і 10000, запустивши три лічильники паралельно.

```python
import multiprocessing


class PrimeCounter(multiprocessing.Process):
    def __init__(self, limit):
        super().__init__()
        self.limit = limit
        self.result = None

    def run(self):
        self.result = sum(
            1
            for n in range(2, self.limit)
            if all(n % d for d in range(2, int(n**0.5) + 1))
        )


if __name__ == "__main__":
    counter = PrimeCounter(10_000)
    counter.start()
    counter.join()
    print(counter.result)
```

## Розв'язки

### Вправа 1

Помилки:

1. Немає перевірки `if __name__ == "__main__":`, тож кожен дочірній процес, запущений через `spawn`, знову намагався б запускати процеси.
2. `args=(n)` — ціле число, а не кортеж. `Process` генерує `TypeError: 'int' object is not iterable`.
3. `p.result` не існує: повернене значення цільової функції губиться.

```python
import multiprocessing


def sum_of_squares(n, results):
    results.put((n, sum(i * i for i in range(n))))


if __name__ == "__main__":
    results = multiprocessing.Queue()
    processes = []
    for n in (10, 100, 1000):
        p = multiprocessing.Process(target=sum_of_squares, args=(n, results))
        p.start()
        processes.append(p)

    answers = dict(results.get() for _ in processes)

    for p in processes:
        p.join()

    for n in sorted(answers):
        print(f"sum of squares below {n}: {answers[n]}")
```

Результат:

```text
sum of squares below 10: 285
sum of squares below 100: 328350
sum of squares below 1000: 332833500
```

Кожен дочірній процес надсилає пару `(n, result)`, тому батьківський процес знає, яка відповідь до чого належить, хоч би в якому порядку вони надійшли. `dict()` перетворює пари на словник.

### Вправа 2

```python
import multiprocessing
import os
import time

N = 30_000_000


def partial_sum(start, stop, results):
    results.put(sum(i * i for i in range(start, stop)))


def parallel_sum(n, workers):
    step = -(-n // workers)  # ділення з округленням угору: розмір частини
    results = multiprocessing.Queue()
    processes = [
        multiprocessing.Process(
            target=partial_sum, args=(start, min(start + step, n), results)
        )
        for start in range(0, n, step)
    ]
    for p in processes:
        p.start()
    total = sum(results.get() for _ in processes)
    for p in processes:
        p.join()
    return total


if __name__ == "__main__":
    workers = os.process_cpu_count() or 1

    start = time.perf_counter()
    expected = sum(i * i for i in range(N))
    print(f"sequential: {time.perf_counter() - start:.2f} s")

    start = time.perf_counter()
    total = parallel_sum(N, workers)
    print(f"{workers} processes: {time.perf_counter() - start:.2f} s")

    print("same result:", total == expected)
    print("formula agrees:", total == (N - 1) * N * (2 * N - 1) // 6)
```

Результат (час і кількість процесів залежать від комп'ютера):

```text
sequential: 0.94 s
10 processes: 0.24 s
same result: True
formula agrees: True
```

`-(-n // workers)` округлює результат ділення вгору, тож частини покривають увесь діапазон, навіть коли `n` не ділиться на `workers` націло. `min(start + step, n)` не дає останній частині вийти за `n`. Порядок, у якому надходять часткові суми, для додавання не важливий. Пришвидшення менше за кількість ядер через витрати на запуск процесів і через те, що не всі ядра однаково швидкі.

### Вправа 3

```python
import multiprocessing
import time


def quick_job():
    time.sleep(0.2)


def endless_job():
    while True:  # помилка: цей цикл ніколи не закінчується
        pass


def run_with_timeout(func, timeout):
    process = multiprocessing.Process(target=func)
    process.start()
    process.join(timeout)
    if process.is_alive():
        process.terminate()
        process.join()
        return f"{func.__name__}: timed out (exitcode {process.exitcode})"
    return f"{func.__name__}: finished (exitcode {process.exitcode})"


if __name__ == "__main__":
    start = time.perf_counter()
    print(run_with_timeout(quick_job, timeout=1))
    print(run_with_timeout(endless_job, timeout=1))
    print(f"total time: {time.perf_counter() - start:.1f} s")
```

Результат (час може трохи відрізнятися):

```text
quick_job: finished (exitcode 0)
endless_job: timed out (exitcode -15)
total time: 1.2 s
```

`join(timeout)` припиняє чекати після тайм-ауту, а `is_alive()` показує, чи процес справді завершився. `join()` після `terminate()` чекає, доки ОС дійсно завершить процес, тож `exitcode` встигає встановитися. Потік, що застряг у `while True`, так зупинити не вдалося б.

### Вправа 4

`run()` виконується в дочірньому процесі, на **копії** об'єкта `PrimeCounter`, що належить цьому процесу. Присвоєння `self.result` там змінює лише копію. Об'єкта в батьківському процесі ніхто не чіпав, тож у ньому так і лишилося `None`. Виправлення — зберігати результат у спільній пам'яті: створити її в `__init__` (він виконується в батьківському процесі) і записувати в `run()`:

```python
import multiprocessing


class PrimeCounter(multiprocessing.Process):
    def __init__(self, limit):
        super().__init__()
        self.limit = limit
        self.result = multiprocessing.Value("q", -1)  # спільне 64-бітне ціле число

    def run(self):
        self.result.value = sum(
            1
            for n in range(2, self.limit)
            if all(n % d for d in range(2, int(n**0.5) + 1))
        )


if __name__ == "__main__":
    counters = [PrimeCounter(limit) for limit in (100, 1_000, 10_000)]
    for c in counters:
        c.start()
    for c in counters:
        c.join()
    for c in counters:
        print(f"primes below {c.limit}: {c.result.value}")
```

Результат:

```text
primes below 100: 25
primes below 1000: 168
primes below 10000: 1229
```

`"q"` — код типу знакового 64-бітного цілого числа. Об'єкт `Value` передається дочірньому процесу під час запуску, і після цього обидва процеси бачать ту саму ділянку пам'яті. У кожен `Value` записує лише один процес, тож блокування не потрібне. `-1` означає «ще не обчислено».

---

*Джерело: [pythontutorial.net — Python Multiprocessing](https://www.pythontutorial.net/advanced-python/python-multiprocessing/). Адаптовано й доповнено для PyJourney.*
