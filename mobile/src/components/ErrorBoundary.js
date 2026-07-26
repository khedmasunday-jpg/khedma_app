import React, { Component } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView, SafeAreaView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { logger } from '../utils/logger';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    logger.error('💥 Unhandled UI Error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error ? this.state.error.toString() : 'Unknown Error';
      const componentStack = this.state.errorInfo ? this.state.errorInfo.componentStack : '';

      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Ionicons name="alert-circle-outline" size={72} color="#e74c3c" />
            </View>

            <Text style={styles.title}>حدث خطأ غير متوقع</Text>
            <Text style={styles.subtitle}>Something went wrong</Text>

            <Text style={styles.description}>
              عذراً، واجه التطبيق مشكلة غير متوقعة. يرجى المحاولة مرة أخرى أو العودة إلى الصفحة الرئيسية.
            </Text>
            <Text style={styles.descriptionEn}>
              An unexpected error occurred. Please try again or return to the main menu.
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.primaryButton} onPress={this.handleReset}>
                <Ionicons name="refresh-outline" size={20} color="#ffffff" style={styles.buttonIcon} />
                <Text style={styles.primaryButtonText}>إعادة المحاولة (Retry)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={this.toggleDetails}>
                <Ionicons
                  name={this.state.showDetails ? 'chevron-up-outline' : 'code-working-outline'}
                  size={18}
                  color="#2f4360"
                  style={styles.buttonIcon}
                />
                <Text style={styles.secondaryButtonText}>
                  {this.state.showDetails ? 'إخفاء التفاصيل' : 'تفاصيل الخطأ (Error Details)'}
                </Text>
              </TouchableOpacity>
            </View>

            {this.state.showDetails && (
              <ScrollView style={styles.detailsContainer} nestedScrollEnabled>
                <Text style={styles.detailsTitle}>Error Summary:</Text>
                <Text style={styles.detailsText}>{errorMsg}</Text>
                {componentStack ? (
                  <>
                    <Text style={[styles.detailsTitle, { marginTop: 10 }]}>Component Stack:</Text>
                    <Text style={styles.detailsText}>{componentStack}</Text>
                  </>
                ) : null}
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f6f0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: 'rgba(255, 252, 246, 0.98)',
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.18)',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#24364f',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 30,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 12px 30px rgba(36, 54, 79, 0.15)',
      },
    }),
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2f4360',
    textAlign: 'center',
    marginBottom: 4,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    color: '#34495e',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  descriptionEn: {
    fontSize: 13,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#2f4360',
    borderRadius: 25,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2f4360',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 8px rgba(47, 67, 96, 0.2)',
      },
    }),
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  secondaryButton: {
    width: '100%',
    height: 44,
    backgroundColor: 'rgba(47, 67, 96, 0.06)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(47, 67, 96, 0.15)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#2f4360',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', web: 'Georgia, serif' }),
  },
  buttonIcon: {
    marginRight: 8,
  },
  detailsContainer: {
    marginTop: 18,
    width: '100%',
    maxHeight: 160,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
  },
  detailsTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailsText: {
    color: '#f8fafc',
    fontSize: 11,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', web: 'monospace' }),
    marginTop: 4,
  },
});

export default ErrorBoundary;
