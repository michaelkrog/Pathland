# Pathland Form Example

This document provides a complete form example demonstrating text components with font styling, lineLimit, and alignment, along with HStack/VStack layouts and event handling.

## Complete Login Form

```json
{
  "type": "vstack",
  "id": "login-form",
  "modifiers": {
    "gap": 24,
    "alignment": "center",
    "padding": {"all": 40},
    "background": {
      "color": "#FFFFFF"
    },
    "frame": {
      "maxWidth": 400
    }
  },
  "children": [
    {
      "type": "text",
      "id": "form-title",
      "content": "Welcome Back",
      "modifiers": {
        "font": {
          "family": ["SF Pro", "Helvetica", "Arial", "sans-serif"],
          "size": 28,
          "weight": "bold"
        },
        "color": "#1D1D1F",
        "textAlignment": "center"
      }
    },
    {
      "type": "text",
      "id": "form-subtitle",
      "content": "Please sign in to continue",
      "modifiers": {
        "font": {
          "size": 16,
          "weight": "regular"
        },
        "color": "#515154",
        "textAlignment": "center"
      }
    },
    {
      "type": "vstack",
      "id": "form-fields",
      "modifiers": {
        "gap": 16,
        "alignment": "leading"
      },
      "children": [
        {
          "type": "text",
          "id": "email-label",
          "content": "Email Address",
          "modifiers": {
            "font": {
              "size": 14,
              "weight": "semibold"
            },
            "color": "#1D1D1F"
          }
        },
        {
          "type": "text",
          "id": "email-input",
          "content": "",
          "modifiers": {
            "font": {
              "family": ["SF Pro", "Helvetica", "Arial", "sans-serif"],
              "size": 16
            },
            "color": "#1D1D1F",
            "lineLimit": 1,
            "textAlignment": "leading",
            "padding": {"horizontal": 16, "vertical": 12},
            "background": {
              "color": "#F5F5F7"
            },
            "border": {
              "width": 1,
              "color": "#D2D2D7",
              "radius": 8
            }
          },
          "events": {
            "onFocus": "handleEmailFocus",
            "onBlur": "handleEmailBlur",
            "onKeyDown": "handleEmailKeyDown"
          }
        },
        {
          "type": "text",
          "id": "email-hint",
          "content": "Enter your email address",
          "modifiers": {
            "font": {
              "size": 12
            },
            "color": "#86868B",
            "lineLimit": 2
          }
        },
        {
          "type": "text",
          "id": "password-label",
          "content": "Password",
          "modifiers": {
            "font": {
              "size": 14,
              "weight": "semibold"
            },
            "color": "#1D1D1F"
          }
        },
        {
          "type": "text",
          "id": "password-input",
          "content": "",
          "modifiers": {
            "font": {
              "family": ["SF Pro", "Helvetica", "Arial", "sans-serif"],
              "size": 16
            },
            "color": "#1D1D1F",
            "lineLimit": 1,
            "textAlignment": "leading",
            "padding": {"horizontal": 16, "vertical": 12},
            "background": {
              "color": "#F5F5F7"
            },
            "border": {
              "width": 1,
              "color": "#D2D2D7",
              "radius": 8
            }
          },
          "events": {
            "onFocus": "handlePasswordFocus",
            "onBlur": "handlePasswordBlur",
            "onKeyDown": "handlePasswordKeyDown"
          }
        },
        {
          "type": "text",
          "id": "password-hint",
          "content": "Enter your password",
          "modifiers": {
            "font": {
              "size": 12
            },
            "color": "#86868B",
            "lineLimit": 2
          }
        }
      ]
    },
    {
      "type": "hstack",
      "id": "remember-forgot",
      "modifiers": {
        "gap": 8,
        "alignment": "center",
        "justification": "spaceBetween"
      },
      "children": [
        {
          "type": "hstack",
          "id": "remember-me",
          "modifiers": {
            "gap": 8,
            "alignment": "center"
          },
          "children": [
            {
              "type": "text",
              "id": "remember-checkbox",
              "content": "☐",
              "modifiers": {
                "font": {"size": 16},
                "padding": {"all": 4},
                "border": {
                  "width": 1,
                  "color": "#D2D2D7",
                  "radius": 4
                }
              },
              "events": {
                "onTap": "toggleRememberMe",
                "onClick": "toggleRememberMe"
              }
            },
            {
              "type": "text",
              "id": "remember-label",
              "content": "Remember me",
              "modifiers": {
                "font": {"size": 14},
                "color": "#515154"
              },
              "events": {
                "onTap": "toggleRememberMe",
                "onClick": "toggleRememberMe"
              }
            }
          ]
        },
        {
          "type": "text",
          "id": "forgot-password",
          "content": "Forgot Password?",
          "modifiers": {
            "font": {
              "size": 14,
              "weight": "semibold"
            },
            "color": "#0071E3",
            "textAlignment": "trailing"
          },
          "events": {
            "onTap": "handleForgotPassword",
            "onClick": "handleForgotPassword"
          }
        }
      ]
    },
    {
      "type": "text",
      "id": "signin-button",
      "content": "Sign In",
      "modifiers": {
        "font": {
          "family": ["SF Pro", "Helvetica", "Arial", "sans-serif"],
          "size": 18,
          "weight": "semibold"
        },
        "color": "#FFFFFF",
        "textAlignment": "center",
        "padding": {"horizontal": 40, "vertical": 16},
        "background": {
          "color": "#0071E3",
          "gradient": {
            "type": "linear",
            "direction": "toBottom",
            "stops": [
              {"position": 0, "color": "#0077ED"},
              {"position": 1, "color": "#006EE3"}
            ]
          }
        },
        "border": {
          "width": 0,
          "radius": 12
        },
        "frame": {
          "width": "100%"
        }
      },
      "events": {
        "onTap": "handleSignIn",
        "onClick": "handleSignIn"
      }
    },
    {
      "type": "hstack",
      "id": "divider",
      "modifiers": {
        "gap": 16,
        "alignment": "center"
      },
      "children": [
        {
          "type": "text",
          "id": "divider-line-1",
          "content": "────────────────────",
          "modifiers": {
            "font": {"size": 1},
            "color": "#D2D2D7"
          }
        },
        {
          "type": "text",
          "id": "divider-text",
          "content": "or",
          "modifiers": {
            "font": {
              "size": 14,
              "color": "#86868B"
            }
          }
        },
        {
          "type": "text",
          "id": "divider-line-2",
          "content": "────────────────────",
          "modifiers": {
            "font": {"size": 1},
            "color": "#D2D2D7"
          }
        }
      ]
    },
    {
      "type": "text",
      "id": "signup-button",
      "content": "Create Account",
      "modifiers": {
        "font": {
          "family": ["SF Pro", "Helvetica", "Arial", "sans-serif"],
          "size": 16,
          "weight": "semibold"
        },
        "color": "#0071E3",
        "textAlignment": "center",
        "padding": {"horizontal": 40, "vertical": 16},
        "background": {
          "color": "#FFFFFF"
        },
        "border": {
          "width": 2,
          "color": "#0071E3",
          "radius": 12
        },
        "frame": {
          "width": "100%"
        }
      },
      "events": {
        "onTap": "handleSignUp",
        "onClick": "handleSignUp"
      }
    }
  ]
}
```

## State Management

```json
{
  "signals": [
    {
      "id": "email",
      "name": "Email Address",
      "value": "",
      "version": 1
    },
    {
      "id": "password",
      "name": "Password",
      "value": "",
      "version": 1
    },
    {
      "id": "rememberMe",
      "name": "Remember Me",
      "value": false,
      "version": 1
    },
    {
      "id": "isEmailFocused",
      "name": "Email Focused",
      "value": false,
      "version": 1
    },
    {
      "id": "isPasswordFocused",
      "name": "Password Focused",
      "value": false,
      "version": 1
    },
    {
      "id": "emailError",
      "name": "Email Error",
      "value": null,
      "version": 1
    },
    {
      "id": "passwordError",
      "name": "Password Error",
      "value": null,
      "version": 1
    }
  ]
}
```

## Event Handlers

```javascript
// Pseudo-code for event handlers

function handleEmailFocus(event) {
  setSignalValue("isEmailFocused", true);
  setSignalValue("isPasswordFocused", false);
  
  // Update input border color
  updateModifier("email-input", "border", {
    "width": 2,
    "color": "#0071E3",
    "radius": 8
  });
  
  // Update password input border back to normal
  updateModifier("password-input", "border", {
    "width": 1,
    "color": "#D2D2D7",
    "radius": 8
  });
}

function handleEmailBlur(event) {
  setSignalValue("isEmailFocused", false);
  
  // Validate email
  const email = getSignalValue("email");
  if (email && !isValidEmail(email)) {
    setSignalValue("emailError", "Please enter a valid email address");
    updateModifier("email-input", "border", {
      "width": 2,
      "color": "#FF3B30",
      "radius": 8
    });
  } else {
    setSignalValue("emailError", null);
    updateModifier("email-input", "border", {
      "width": 1,
      "color": "#D2D2D7",
      "radius": 8
    });
  }
}

function handleEmailKeyDown(event) {
  if (event.data.key === "Enter") {
    // Move focus to password field
    focusComponent("password-input");
  }
}

function handlePasswordFocus(event) {
  setSignalValue("isPasswordFocused", true);
  setSignalValue("isEmailFocused", false);
  
  // Update input border color
  updateModifier("password-input", "border", {
    "width": 2,
    "color": "#0071E3",
    "radius": 8
  });
  
  // Update email input border back to normal
  updateModifier("email-input", "border", {
    "width": 1,
    "color": "#D2D2D7",
    "radius": 8
  });
}

function handlePasswordBlur(event) {
  setSignalValue("isPasswordFocused", false);
  
  // Validate password
  const password = getSignalValue("password");
  if (password && password.length < 8) {
    setSignalValue("passwordError", "Password must be at least 8 characters");
    updateModifier("password-input", "border", {
      "width": 2,
      "color": "#FF3B30",
      "radius": 8
    });
  } else {
    setSignalValue("passwordError", null);
    updateModifier("password-input", "border", {
      "width": 1,
      "color": "#D2D2D7",
      "radius": 8
    });
  }
}

function handlePasswordKeyDown(event) {
  if (event.data.key === "Enter") {
    handleSignIn();
  }
}

function toggleRememberMe(event) {
  const current = getSignalValue("rememberMe");
  setSignalValue("rememberMe", !current);
  
  // Update checkbox display
  const checkbox = getComponent("remember-checkbox");
  updateTextContent("remember-checkbox", current ? "☐" : "☑");
}

function handleForgotPassword(event) {
  // Navigate to forgot password screen
  navigateTo("forgot-password");
}

function handleSignIn(event) {
  const email = getSignalValue("email");
  const password = getSignalValue("password");
  
  // Validate
  let isValid = true;
  
  if (!email || !isValidEmail(email)) {
    setSignalValue("emailError", "Please enter a valid email address");
    isValid = false;
  }
  
  if (!password || password.length < 8) {
    setSignalValue("passwordError", "Password must be at least 8 characters");
    isValid = false;
  }
  
  if (!isValid) {
    return;
  }
  
  // Perform sign in
  signIn(email, password, getSignalValue("rememberMe"));
}

function handleSignUp(event) {
  // Navigate to sign up screen
  navigateTo("signup");
}

// Helper function
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

## Component Breakdown

### Form Container (VStack)
- **Type:** `vstack`
- **Modifiers:**
  - `gap: 24` - Spacing between form sections
  - `alignment: "center"` - Center children horizontally
  - `padding: {all: 40}` - Padding around the form
  - `background: {color: "#FFFFFF"}` - White background
  - `frame: {maxWidth: 400}` - Limit form width

### Title (Text)
- **Type:** `text`
- **Content:** "Welcome Back"
- **Modifiers:**
  - `font: {size: 28, weight: "bold"}` - Large, bold font
  - `color: "#1D1D1F"` - Dark text
  - `textAlignment: "center"` - Centered

### Subtitle (Text)
- **Type:** `text`
- **Content:** "Please sign in to continue"
- **Modifiers:**
  - `font: {size: 16}` - Medium font
  - `color: "#515154"` - Gray text
  - `textAlignment: "center"` - Centered

### Form Fields Container (VStack)
- **Type:** `vstack`
- **Modifiers:**
  - `gap: 16` - Spacing between fields
  - `alignment: "leading"` - Left-aligned children

### Email Label (Text)
- **Type:** `text`
- **Content:** "Email Address"
- **Modifiers:**
  - `font: {size: 14, weight: "semibold"}` - Small, semi-bold
  - `color: "#1D1D1F"` - Dark text

### Email Input (Text)
- **Type:** `text`
- **Content:** Dynamic (user input)
- **Modifiers:**
  - `font: {size: 16}` - Medium font
  - `color: "#1D1D1F"` - Dark text
  - `lineLimit: 1` - Single line only
  - `textAlignment: "leading"` - Left-aligned
  - `padding: {horizontal: 16, vertical: 12}` - Input padding
  - `background: {color: "#F5F5F7"}` - Light gray background
  - `border: {width: 1, color: "#D2D2D7", radius: 8}` - Light border with rounded corners
- **Events:**
  - `onFocus: "handleEmailFocus"` - When input gains focus
  - `onBlur: "handleEmailBlur"` - When input loses focus
  - `onKeyDown: "handleEmailKeyDown"` - When keys are pressed

### Email Hint (Text)
- **Type:** `text`
- **Content:** "Enter your email address"
- **Modifiers:**
  - `font: {size: 12}` - Small font
  - `color: "#86868B"` - Light gray text
  - `lineLimit: 2` - Maximum 2 lines

### Password Input (Text)
- **Type:** `text`
- **Content:** Dynamic (user input, masked)
- **Modifiers:**
  - Similar to email input
  - Note: In a real implementation, the content would be masked (e.g., "••••••••")

### Remember Me Section (HStack)
- **Type:** `hstack`
- **Modifiers:**
  - `gap: 8` - Spacing between checkbox and label
  - `alignment: "center"` - Vertically center items

### Remember Me Checkbox (Text)
- **Type:** `text`
- **Content:** "☐" or "☑" (checkbox character)
- **Modifiers:**
  - `font: {size: 16}` - Medium font
  - `padding: {all: 4}` - Small padding
  - `border: {width: 1, color: "#D2D2D7", radius: 4}` - Light border
- **Events:**
  - `onTap: "toggleRememberMe"` - Toggle checkbox state
  - `onClick: "toggleRememberMe"` - Toggle checkbox state

### Remember Me Label (Text)
- **Type:** `text`
- **Content:** "Remember me"
- **Modifiers:**
  - `font: {size: 14}` - Medium font
  - `color: "#515154"` - Gray text
- **Events:**
  - `onTap: "toggleRememberMe"` - Toggle checkbox state
  - `onClick: "toggleRememberMe"` - Toggle checkbox state

### Forgot Password (Text)
- **Type:** `text`
- **Content:** "Forgot Password?"
- **Modifiers:**
  - `font: {size: 14, weight: "semibold"}` - Medium, semi-bold
  - `color: "#0071E3"` - Blue text
  - `textAlignment: "trailing"` - Right-aligned
- **Events:**
  - `onTap: "handleForgotPassword"` - Navigate to forgot password
  - `onClick: "handleForgotPassword"` - Navigate to forgot password

### Sign In Button (Text)
- **Type:** `text`
- **Content:** "Sign In"
- **Modifiers:**
  - `font: {size: 18, weight: "semibold"}` - Medium, semi-bold
  - `color: "#FFFFFF"` - White text
  - `textAlignment: "center"` - Centered
  - `padding: {horizontal: 40, vertical: 16}` - Button padding
  - `background: {color: "#0071E3", gradient: {...}}` - Blue gradient background
  - `border: {radius: 12}` - Rounded corners
  - `frame: {width: "100%"}` - Full width
- **Events:**
  - `onTap: "handleSignIn"` - Submit form
  - `onClick: "handleSignIn"` - Submit form

### Divider (HStack)
- **Type:** `hstack`
- **Modifiers:**
  - `gap: 16` - Spacing between lines and text
  - `alignment: "center"` - Vertically center items
- **Children:** Two lines and "or" text in the middle

### Create Account Button (Text)
- **Type:** `text`
- **Content:** "Create Account"
- **Modifiers:**
  - `font: {size: 16, weight: "semibold"}` - Medium, semi-bold
  - `color: "#0071E3"` - Blue text
  - `textAlignment: "center"` - Centered
  - `padding: {horizontal: 40, vertical: 16}` - Button padding
  - `background: {color: "#FFFFFF"}` - White background
  - `border: {width: 2, color: "#0071E3", radius: 12}` - Blue border
  - `frame: {width: "100%"}` - Full width
- **Events:**
  - `onTap: "handleSignUp"` - Navigate to sign up
  - `onClick: "handleSignUp"` - Navigate to sign up

## Key Features Demonstrated

### Text Component Features
1. **Font styling** - Various sizes, weights, families
2. **Line limit** - Single line for inputs, multiple lines for hints
3. **Text alignment** - Leading (left), center, trailing (right)
4. **Color** - Different colors for different text purposes

### Layout Features
1. **VStack for form layout** - Vertical arrangement of form sections
2. **HStack for inline elements** - Checkbox + label, divider lines
3. **Nested stacks** - Complex form structure
4. **Gap control** - Consistent spacing between elements
5. **Alignment control** - Different alignment for different sections
6. **Justification** - Space between for button row

### Style Features
1. **Padding** - Input padding, button padding
2. **Background** - Solid colors, gradients
3. **Border** - Width, color, radius
4. **Frame constraints** - Max width, full width

### Event Features
1. **Focus/Blur events** - For input field interaction
2. **KeyDown events** - For keyboard navigation
3. **Tap/Click events** - For button and interactive element handling

### State Features
1. **Form state** - Email, password, remember me
2. **UI state** - Focus state, error state
3. **Validation** - Email and password validation
4. **Dynamic updates** - Border color changes based on state

## Visual Representation

```
┌─────────────────────────────────────────┐
│                                             │
│              Welcome Back                   │
│          Please sign in to continue         │
│                                             │
│  Email Address                              │
│  ┌─────────────────────────────────────┐ │
│  │ Enter your email address             │ │
│  └─────────────────────────────────────┘ │
│                                             │
│  Password                                   │
│  ┌─────────────────────────────────────┐ │
│  │ Enter your password                  │ │
│  └─────────────────────────────────────┘ │
│                                             │
│  ☐ Remember me              Forgot Password?│
│                                             │
│  ┌─────────────────────────────────────┐ │
│  │           Sign In                     │ │
│  └─────────────────────────────────────┘ │
│                                             │
│         or                                  │
│                                             │
│  ┌─────────────────────────────────────┐ │
│  │         Create Account                │ │
│  └─────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────┘
```

## Implementation Notes

### For Web Renderer
- Use `<input type="email">` and `<input type="password">` for text inputs
- Use flexbox for HStack/VStack layout
- Use CSS for styling
- Map events to DOM events

### For Mobile Renderer
- Use platform-specific text input components
- Use platform-specific layout systems
- Map events to touch/keyboard events

### For Embedded Renderer
- Implement text input with on-screen keyboard
- Implement layout engine
- Map events to input device events

## Validation and Error Handling

The form includes validation:
1. **Email validation** - Checks for valid email format
2. **Password validation** - Minimum 8 characters
3. **Visual feedback** - Red border for invalid inputs
4. **Error messages** - Displayed below invalid inputs

## Accessibility Considerations

For a production implementation, consider adding:
1. **ARIA labels** - For screen readers
2. **Keyboard navigation** - Tab order, focus management
3. **Focus indicators** - Visual focus states
4. **Error announcements** - For screen readers
5. **Required field indicators** - Visual and screen reader

## Extensions

This example can be extended with:
1. **Password visibility toggle** - Show/hide password
2. **Loading state** - Disable buttons during submission
3. **Success/error messages** - After form submission
4. **Social login** - Add social login buttons
5. **Form persistence** - Save form state
6. **Auto-focus** - Focus first field on load
