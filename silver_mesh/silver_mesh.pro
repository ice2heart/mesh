TEMPLATE = app
CONFIG += console
CONFIG -= app_bundle
CONFIG -= qt

SOURCES += main.c


INCLUDEPATH += $$PWD/libuv/include
win32: LIBS += -lws2_32 -ladvapi32 -liphlpapi -lpsapi -luser32 -luserenv
win32: LIBS += -L$$PWD/libuv -llibuv
#QMAKE_LFLAGS_DEBUG += /NODEFAULTLIB:MSVCRT
#QMAKE_CXXFLAGS += /MDd

