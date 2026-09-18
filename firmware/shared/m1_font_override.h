/* Include AFTER original headers, in menu / LCD / numeric dialog translation units.
   Only the small menu font is replaced. The large digit font is unchanged. */
#ifndef M1_FONT_OVERRIDE_H
#define M1_FONT_OVERRIDE_H
#include "m1_menu_font.h"
#undef GUI_FONT_HELVETICA_16
#define GUI_FONT_HELVETICA_16 GUI_FONT_M1_MENU
#endif
