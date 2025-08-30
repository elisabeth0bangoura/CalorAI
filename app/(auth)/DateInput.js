import { router } from 'expo-router'; // ✅ ok to use in class modules
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import {
  InteractionManager,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { size } from 'react-native-responsive-sizes';

class DateInputInner extends Component {
  static propTypes = {
    mask: PropTypes.string,
    validate: PropTypes.bool,
    activeColor: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    inputProps: PropTypes.object,
    /** where to push when complete, string or { pathname, params } */
    pushTo: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        pathname: PropTypes.string.isRequired,
        params: PropTypes.object,
      }),
    ]),
    /** optional: called right before navigation with (formattedDate) */
    onComplete: PropTypes.func,
  };

  static defaultProps = {
    mask: 'DD MM YYYY',
    onChange: () => {},
    activeColor: '#222',
    validate: true,
    inputProps: {},
    pushTo: undefined,
    onComplete: undefined,
  };

  constructor(props) {
    super(props);

    let index = -1;
    const mask = props.mask.split('').map((v) => {
      const isTextField = ['D', 'M', 'Y'].includes(v);
      if (isTextField) index++;
      return { text: v, isTextField, index };
    });

    const maxLength = mask.filter((m) => m.isTextField).length;

    this.state = { date: '', mask, maxLength, isFocused: false, didNavigate: false };
  }

  componentDidMount() {
    InteractionManager.runAfterInteractions(() => {
      this.focusHiddenInput();
    });
    this._focusTimer = setTimeout(this.focusHiddenInput, 300);
  }

  componentDidUpdate() {
    if (!this.state.isFocused) this.focusHiddenInput();
  }

  componentWillUnmount() {
    if (this._focusTimer) clearTimeout(this._focusTimer);
  }

  // callable from parent via ref
  focusHiddenInput = () => {
    if (this.input && typeof this.input.focus === 'function') this.input.focus();
  };

  handleTextChange = (date) => {
    const { validate, onChange, pushTo, onComplete } = this.props;
    const { mask, maxLength, didNavigate } = this.state;

    const M = mask.filter((v) => v.text === 'M').map((v) => date[v.index]).join('');
    const D = mask.filter((v) => v.text === 'D').map((v) => date[v.index]).join('');
    const Y = mask.filter((v) => v.text === 'Y').map((v) => date[v.index]).join('');

    if (validate && date.length >= this.state.date.length) {
      if (M.length === 2) {
        const m = parseInt(M, 10);
        if (Number.isNaN(m) || m < 1 || m > 12) return;
      }
      if (D.length === 2) {
        const yearForDays = Y.length === 4 ? parseInt(Y, 10) : new Date().getFullYear();
        const monthForDays = M.length === 2 ? parseInt(M, 10) : 12;
        const maxDay = new Date(yearForDays, Math.max(1, monthForDays), 0).getDate();
        const d = parseInt(D, 10);
        if (Number.isNaN(d) || d < 1 || d > maxDay) return;
      }
      if (Y.length === 4) {
        const y = parseInt(Y, 10);
        if (Number.isNaN(y) || y < 1900 || y > 2100) return;
      }
    }

    // When full length reached, format and navigate once
    if (date.length === maxLength && !didNavigate) {
      const paddedD = D.padStart(2, '0');
      const paddedM = M.padStart(2, '0');

      // NOTE: This formats as MM.DD.YYYY when mask is "MM DD YYYY".
      // If you want DD.MM.YYYY, set mask to "DD MM YYYY" and swap below.
      const formatted = `${paddedM}.${paddedD}.${Y}`;

      onChange(formatted);

      if (typeof onComplete === 'function') {
        try { onComplete(formatted); } catch {}
      }

      if (pushTo) {
        // prevent multiple pushes
        this.setState({ didNavigate: true }, () => {
          if (typeof pushTo === 'string') {
            router.push({
              pathname: pushTo,
              params: { Birthday: formatted },
            });
          } else if (pushTo?.pathname) {
            router.push({
              pathname: pushTo.pathname,
              params: { ...(pushTo.params || {}), Birthday: formatted },
            });
          }
        });
      }
    }

    this.setState({ date });
  };

  render() {
    const { isFocused, date, mask } = this.state;
    const { activeColor, inputProps } = this.props;

    return (
      <TouchableWithoutFeedback onPress={this.focusHiddenInput}>
        <View style={styles.container} onLayout={this.focusHiddenInput}>
          <TextInput
            autoFocus
            editable
            keyboardType="number-pad"
            style={styles.hiddenInput}
            onFocus={() => this.setState({ isFocused: true })}
            onBlur={() => this.setState({ isFocused: false })}
            maxLength={this.state.maxLength}
            ref={(ref) => { this.input = ref; }}
            value={date}
            onChangeText={this.handleTextChange}
            textContentType="none"
            importantForAutofill="no"
            blurOnSubmit={false}
            accessible={false}
            {...inputProps}
          />

          {mask.map((v, key) => (
            <TouchableWithoutFeedback key={key} onPress={this.focusHiddenInput}>
              <View style={styles.charContainer}>
                {v.isTextField ? (
                  <TextInput
                    editable={false}
                    placeholder={v.text}
                    placeholderTextColor="#222"
                    style={[
                      styles.charInput,
                      {
                        borderBottomColor:
                          isFocused && date.length === v.index ? activeColor : '#222',
                      },
                    ]}
                    value={date[v.index]}
                  />
                ) : (
                  <Text style={styles.separator}>{v.text}</Text>
                )}
              </View>
            </TouchableWithoutFeedback>
          ))}
        </View>
      </TouchableWithoutFeedback>
    );
  }
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, flexWrap: 'nowrap' },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1, left: 0, top: 0 },
  charContainer: { paddingHorizontal: 6 },
  charInput: { paddingVertical: 4, fontSize: size(24), fontFamily: 'Open-Sans', textAlign: 'center', borderBottomWidth: 2, minWidth: 24, color: '#333' },
  separator: { fontSize: 22, color: '#bbb' },
});

export default React.forwardRef((props, ref) => <DateInputInner {...props} ref={ref} />);
